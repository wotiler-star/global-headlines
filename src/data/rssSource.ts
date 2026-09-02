import { Locale, Category, locales, categories } from "@/i18n/config";
import { Article } from "@/data/news";
import * as mock from "@/data/news";
import fs from "fs";
import path from "path";

// ============================================================================
// RSS 聚合源（构建时拉取，静态导出）
// ----------------------------------------------------------------------------
// 设计要点：
//  - 在 `next build` 阶段（服务端、唯一能联网的时机）拉取主流媒体 RSS，
//  - 解析标题/摘要/正文/封面/原文链接，生成 Article（带 sourceUrl）。
//  - 任意 feed 失败 / 网络不通 → 该分类回退内置 mock；整语言全失败 → 首页回退 mock。
//  - 密钥无关，纯 RSS，合法稳定。真实视频仍走 videoSource（需 YOUTUBE_API_KEY）。
//  - 环境变量：RSS_ENABLED=false 可关闭（默认开启）。
// ============================================================================

export const RSS_ENABLED = process.env.RSS_ENABLED !== "false";

type RssCat = Exclude<Category, "recommend" | "video">;

// France24 RSS（on france24.com，构建沙箱网络可达；fr 覆盖完整，ja 原生源不可达故回退 mock）
const FR24: Record<RssCat, string> = {
  world: "https://www.france24.com/fr/actualites/rss",
  tech: "https://www.france24.com/fr/rss",
  finance: "https://www.france24.com/fr/economie/rss",
  sports: "https://www.france24.com/fr/sport/rss",
  entertainment: "https://www.france24.com/fr/culture/rss",
  health: "https://www.france24.com/fr/rss",
  science: "https://www.france24.com/fr/environnement/rss",
};

// 主流媒体 RSS 订阅源地图（locale → category → feed urls）
// 选的都是长期稳定、无需密钥的公开 RSS；某一分类/语言没有可靠源就不填，自动回退 mock。
// ja/fr 原生源（NHK / Le Monde）在构建沙箱网络不可达，改用 Google News RSS 保证真实内容。
const FEEDS: Partial<Record<Locale, Partial<Record<RssCat, string[]>>>> = {
  en: {
    world: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
    tech: ["https://www.theverge.com/rss/index.xml"],
    finance: ["https://www.cnbc.com/id/10001147/device/rss/rss.html"],
    sports: ["https://www.espn.com/espn/rss/news"],
    entertainment: ["https://variety.com/feed/"],
    health: ["https://feeds.bbci.co.uk/news/health/rss.xml"],
    science: ["https://www.sciencedaily.com/rss/all.xml"],
  },
  ja: {
    // 构建沙箱网络不可达任何日语音源（NHK/.or.jp、asahi/.com 等皆超时/失败），
    // 故 ja 不配置 RSS，首页整语言回退内置 mock（日文 UI 完整可用）。
  },
  ko: {
    world: ["https://www.yna.co.kr/rss/world.xml"],
    tech: ["https://www.yna.co.kr/rss/it.xml"],
    finance: ["https://www.yna.co.kr/rss/economy.xml"],
    sports: ["https://www.yna.co.kr/rss/sports.xml"],
    entertainment: ["https://www.yna.co.kr/rss/entertainment.xml"],
  },
  es: {
    world: ["https://feeds.bbci.co.uk/mundo/rss.xml"],
    tech: ["https://www.xataka.com/index.xml"],
    finance: ["https://www.bolsamania.com/noticias/rss/"],
    sports: ["https://www.marca.com/rss/portada.xml"],
    entertainment: ["https://www.elmundo.es/rss/elmundo/cultura.xml"],
  },
  fr: {
    world: [FR24.world],
    tech: [FR24.tech],
    finance: [FR24.finance],
    sports: [FR24.sports],
    entertainment: [FR24.entertainment],
    health: [FR24.health],
    science: [FR24.science],
  },
  zh: {
    tech: [
      "https://www.36kr.com/feed",
      "https://www.ifanr.com/feed",
      "https://sspai.com/feed",
      "https://www.qbitai.com/feed",
    ],
    world: ["https://feedx.net/rss/people.politics.xml"],
    finance: ["https://www.36kr.com/feed"],
  },
};

// ---------------------------------------------------------------------------
// 简易 XML / 文本清洗（构建时 Node 环境，无 DOMParser，纯正则）
// ---------------------------------------------------------------------------
function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
  return decodeEntities(
    s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

function getAttr(block: string, attr: string): string {
  const m = block.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : "";
}

function matchAll(block: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = g.exec(block)) !== null) out.push(m[1]);
  return out;
}

function firstImg(html: string): string {
  const m = html.match(/<img\b[^>]*src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

// ---------------------------------------------------------------------------
// 解析单条 RSS <item> 或 Atom <entry> → Article
// ---------------------------------------------------------------------------
function parseItem(
  itemXml: string,
  locale: Locale,
  category: RssCat,
  feedTitle: string
): Article | null {
  let title = stripHtml(getTag(itemXml, "title"));
  if (!title) return null;

  // Google News 标题形如「头条 - 来源」，先记下完整串，待 source 声明后再剥离
  const rawTitle = title;

  // 链接：RSS <link> 文本，或 Atom <link href="...">
  let link = getTag(itemXml, "link");
  if (!link) {
    const hrefs = matchAll(itemXml, /<link\b[^>]*href=["']([^"']+)["']/gi);
    link = hrefs.find((h) => !/\.xml$/i.test(h)) || hrefs[0] || "";
  }
  if (!link) return null;

  const summaryRaw = getTag(itemXml, "description") || getTag(itemXml, "summary");
  const contentRaw =
    getTag(itemXml, "content:encoded") || getTag(itemXml, "content");
  const summary = stripHtml(summaryRaw).slice(0, 240);
  const bodyText = contentRaw ? stripHtml(contentRaw) : summary;

  const dateRaw =
    getTag(itemXml, "pubDate") ||
    getTag(itemXml, "updated") ||
    getTag(itemXml, "published");
  const publishedAt = dateRaw ? Date.parse(dateRaw) || Date.now() : Date.now();

  // 封面：media:thumbnail / media:content → enclosure(image) → 正文首图
  let image = "";
  const media = itemXml.match(/<media:(?:thumbnail|content)\b[^>]*url=["']([^"']+)["']/i);
  if (media) image = media[1];
  if (!image) {
    const enc =
      itemXml.match(/<enclosure\b[^>]*type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i) ||
      itemXml.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i);
    if (enc) image = enc[1];
  }
  if (!image) image = firstImg(contentRaw || summaryRaw);

  const tags = matchAll(itemXml, /<category\b[^>]*>([\s\S]*?)<\/category>/gi)
    .map(stripHtml)
    .filter(Boolean);
  // Atom 用 term 属性标注分类（自闭合，无文本内容）
  const atomTags = tags.length
    ? tags
    : matchAll(itemXml, /<category\b[^>]*term=["']([^"']+)["']/gi);
  const finalTags = atomTags.slice(0, 4);

  let source = feedTitle;
  // Google News 标题形如「头条 - 来源」：剥离后缀得到干净标题 + 真实来源名
  if (feedTitle.toLowerCase().includes("google") && rawTitle.includes(" - ")) {
    const m = rawTitle.match(/^(.*?)\s+-\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      if (!source || source.toLowerCase().includes("google")) source = m[2].trim();
    }
  }
  // France24 频道标题形如「Environnement : ... - France 24」，来源统一为 France 24
  if (feedTitle.toLowerCase().includes("france 24")) {
    source = "France 24";
    if (title.endsWith(" - France 24")) title = title.slice(0, -" - France 24".length).trim();
  }
  if (!source && link) {
    try {
      source = new URL(link).hostname.replace(/^www\./, "");
    } catch {
      source = "RSS";
    }
  }

  const id = `rss-${hashStr(link)}`;
  const images = image ? [image] : [`https://picsum.photos/seed/${id}/600/400`];
  const words = bodyText ? bodyText.split(/\s+/).length : 0;
  const readMinutes = Math.max(2, Math.round(words / 200)) || 3;

  return {
    id,
    locale,
    category,
    title,
    summary: summary || title,
    body: bodyText ? [bodyText] : [summary || title],
    source,
    author: source,
    publishedAt,
    imageCount: 1,
    images,
    tags: finalTags.length ? finalTags : [title],
    readMinutes,
    sourceUrl: link,
  };
}

// ---------------------------------------------------------------------------
// 抓取单个 feed（带超时与失败兜底）
// ---------------------------------------------------------------------------
async function fetchFeed(url: string, locale: Locale, category: RssCat): Promise<Article[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    headers: {
      "User-Agent": "Mozilla/5.0 (GlobalHeadlines/1.0; +https://global-headlines.example.com)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    redirect: "follow",
  });
  if (!res.ok) return [];
  const xml = await res.text();

  // feed 标题（渠道名 / 站点名）
  let feedTitle = "";
  const ch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  if (ch) feedTitle = stripHtml(getTag(ch[1], "title"));
  if (!feedTitle) {
    const fe = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i);
    if (fe) feedTitle = stripHtml(getTag(fe[1], "title"));
  }

  const items = matchAll(xml, /<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  const entries = matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi);
  const blocks = items.length ? items : entries;

  const out: Article[] = [];
  for (const b of blocks) {
    const a = parseItem(b, locale, category, feedTitle);
    if (a) out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 缓存 + 按 (locale, category) 拉取
// ---------------------------------------------------------------------------
const byId = new Map<string, Article>();
const cache = new Map<string, Article[]>();

// 构建时数据库缓存：collect-articles.mjs 生成的 data/articles.json（真实 SQLite 的 JSON 镜像）。
// 存在则直接当作「单一真相源」读取，跳过联网；不存在则退回实时拉取（兼容直接 next build）。
let jsonDb: Article[] | null = null;
let jsonDbLoaded = false;
function loadJsonDb(): Article[] | null {
  if (jsonDbLoaded) return jsonDb;
  jsonDbLoaded = true;
  try {
    const p = path.join(process.cwd(), "data", "articles.json");
    if (fs.existsSync(p)) {
      jsonDb = JSON.parse(fs.readFileSync(p, "utf8")) as Article[];
      return jsonDb;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getRssArticles(locale: Locale, category: RssCat): Promise<Article[]> {
  const key = `${locale}:${category}`;
  const c = cache.get(key);
  if (c) return c;

  // 优先使用采集数据库（data/articles.json），避免重复联网、支持离线重建
  const db = loadJsonDb();
  if (db) {
    const out = db.filter((a) => a.locale === locale && a.category === category);
    for (const a of out) byId.set(a.id, a);
    cache.set(key, out);
    return out;
  }

  const urls = FEEDS[locale]?.[category];
  if (!urls || urls.length === 0) return [];

  const results = await Promise.all(
    urls.map((u) => fetchFeed(u, locale, category).catch(() => [] as Article[]))
  );
  const merged = results.flat();

  // 去重（按原文链接）
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of merged) {
    if (a.sourceUrl && seen.has(a.sourceUrl)) continue;
    if (a.sourceUrl) seen.add(a.sourceUrl);
    byId.set(a.id, a);
    out.push(a);
  }
  cache.set(key, out);
  return out;
}

export function findRssArticle(id: string): Article | undefined {
  return byId.get(id);
}

// ---------------------------------------------------------------------------
// 首页混合流：拉取该语言所有配置了 RSS 的分类；未覆盖的分类用 mock 补齐，
// 保证首页始终满；若 RSS 全失败（网络不通）→ 返回 null 让上层回退 mock 首页。
// ---------------------------------------------------------------------------
export async function getRssHomeFeed(locale: Locale): Promise<Article[] | null> {
  const catMap = FEEDS[locale];
  if (!catMap) return null;
  const cats = Object.keys(catMap) as RssCat[];
  const results = await Promise.all(
    cats.map((c) => getRssArticles(locale, c).catch(() => [] as Article[]))
  );

  const allContent = categories.filter(
    (c) => c !== "video" && c !== "recommend"
  ) as RssCat[];

  const feed: Article[] = [];
  let real = 0;
  for (const c of allContent) {
    const idx = cats.indexOf(c);
    const rss = idx >= 0 ? results[idx] : [];
    if (rss.length) {
      feed.push(...rss);
      real += rss.length;
    } else {
      feed.push(...mock.getArticles(locale, c));
    }
  }

  if (real === 0) return null; // RSS 整语言失败 → 由上层回退 mock
  // 真实采集文章置顶，避免无真实 RSS 的分类（如 zh 的 world）的 mock  fallback 抢占首屏。
  return feed.sort((a, b) => {
    const aReal = a.id.startsWith("rss-") ? 0 : 1;
    const bReal = b.id.startsWith("rss-") ? 0 : 1;
    if (aReal !== bReal) return aReal - bReal;
    return b.publishedAt - a.publishedAt;
  });
}

// 仅用于构建日志，确认哪些语言成功拉到了真实 RSS
export function rssFeedCount(locale: Locale): number {
  return Object.keys(FEEDS[locale] || {}).length;
}
