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
  culture: "https://www.france24.com/fr/culture/rss",
};

// 主流媒体 RSS 订阅源地图（locale → category → feed urls）
// 选的都是长期稳定、无需密钥的公开 RSS；某一分类/语言没有可靠源就不填，自动回退 mock。
// ja/fr 原生源（NHK / Le Monde）在构建沙箱网络不可达，改用 Google News RSS 保证真实内容。
const FEEDS: Partial<Record<Locale, Partial<Record<RssCat, string[]>>>> = {
  en: {
    // cov19 主要大国分站源（服务器实测可达，容器启动时由 collect-articles 入库）：
    // 俄 TASS · 加 CBC · 沙特 Arab News · 巴西 G1 · 印度 The Hindu · 南非 SABC · 澳 ABC
    // cov20 分站源：德 DW/明镜 · 意 共和报/AGI/24小时太阳报 · 日 时报(英) · 埃及 DNE/独立报(英)
    world: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://tass.com/rss/v2.xml",
      "https://www.cbc.ca/cmlink/rss-topstories",
      "https://www.arabnews.com/rss",
      "https://g1.globo.com/rss/g1/",
      "https://www.thehindu.com/news/national/feeder/default.rss",
      "https://www.sabcnews.com/sabcnews/feed/",
      "https://www.abc.net.au/news/feed/51120/rss.xml",
      "https://rss.dw.com/rdf/rss-en-world",
      "https://www.spiegel.de/schlagzeilen/index.rss",
      "https://www.repubblica.it/rss/homepage/rss2.0.xml",
      "https://www.agi.it/rss",
      "https://www.ilsole24ore.com/rss/economia.xml",
      "https://www.japantimes.co.jp/feed/",
      "https://dailynewsegypt.com/feed/",
      "https://www.egyptindependent.com/feed/",
      // cov23：YNA 英文源——韩文主站被限流(ECONNRESET)时的 ICN 备份源（英文内容）
      "https://en.yna.co.kr/RSS/news.xml",
      // cov28 分站源（葡语 / 土耳其 / 东南亚 数据覆盖扩充；与 collect-articles.mjs 保持一致）
      // —— 葡语区 ——
      "https://www.publico.pt/rss",
      "https://www.observador.pt/rss/",
      "https://www.uol.com.br/rss/",
      // —— 土耳其（cov34：替换不可达端点 aa/hurriyet/dailysabah；trthaber 服务器实测 OK）——
      "https://www.trthaber.com/sondakika.rss",
      // —— 东南亚（英文版）——
      "https://www.bangkokpost.com/rss/news",
      "https://www.antaranews.com/rss",
      "https://www.thestar.com.my/rss/news",
      "https://www.channelnewsasia.com/api/v1/rss/home",
      "https://tuoitre.vn/rss/home.rss",
      "https://www.inquirer.net/feed",                       // MNL 马尼拉（菲律宾英文；cov34 补回，此前仅映射未入 FEEDS）
      // cov29：更多非洲 / 中东 稳定源（国际桶，跨语言聚合）
      "https://www.middleeasteye.net/rss",                   // DXB 迪拜（cov34 替换 404 的 thenationalnews）
      "https://www.timesofisrael.com/feed/",
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://www.jordantimes.com/rss",
      "https://www.capitalfm.co.ke/feed/",                   // NBO 内罗毕（cov34 替换 403 的 nation.africa）
      "https://www.iol.co.za/rss",
      "https://addisstandard.com/feed/",
      "https://www.mosaiquefm.net/rss",                       // TUN 突尼斯（cov34 替换 403 的 lapresse.tn）
      "https://www.myjoyonline.com/rss",                     // GHA 阿克拉（cov34 替换 NOITEMS 的 ghanaweb）
      // cov30 中亚分站源（国际桶，跨语言聚合显示信号）
      "https://tengrinews.kz/rss/",
      "https://www.inform.kz/rss",
      "https://kun.uz/rss",
      "https://www.gazeta.uz/rss",
      "https://24.kg/rss/",
      "https://asiaplustj.info/rss",
      "https://report.az/rss",
      "https://www.trend.az/rss",
      // cov31 北欧 / 巴尔干 分站源（国际桶，跨语言聚合显示信号）
      // —— 北欧 ——
      "https://www.thelocal.no/feed/",         // OSL 奥斯陆（挪威英文；cov34 /rss→/feed）
      "https://www.thelocal.dk/feed/",         // CPH 哥本哈根（丹麦英文；cov34 /rss→/feed）
      "https://www.foreigner.fi/feed/",        // HEL 赫尔辛基（芬兰英文）
      // —— 巴尔干 ——
      "https://rs.n1info.com/feed/",            // BEG 贝尔格莱德（塞尔维亚英文）
      "https://nezavisen.mk/feed/",             // SKP 斯科普里（北马其顿；cov34 替换 403 的 time.mk）
      "https://www.total-croatia-news.com/feed/", // ZAG 萨格勒布（克罗地亚英文）
      "https://www.novinite.com/section.rss",   // SOF 索菲亚（保加利亚英文）
      "https://www.sarajevotimes.com/feed/",    // SAR 萨拉热窝（波黑英文）
      // —— 南亚（cov32；挂 en.world 国际桶，跨语言聚合显示信号）——
      "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", // DEL 德里（印度英文）
      "https://www.freepressjournal.in/feed",                       // BOM 孟买（印度英文）
      "https://kathmandupost.com/rss",                              // KTM 加德满都（尼泊尔英文）
      "https://www.dailynews.lk/rss",                               // CMB 科伦坡（斯里兰卡英文）
      "https://www.dawn.com/feeds/home.rss",                        // ISB 伊斯兰堡（巴基斯坦英文）
      "https://www.thenews.com.pk/rss/1/3",                         // KHI 卡拉奇（巴基斯坦英文）
      "https://tribune.com.pk/feed",                                // LAH 拉合尔（巴基斯坦英文）
      // —— 中亚补全（cov32）——
      "https://www.ubpost.mn/feed/",                                // ULN 乌兰巴托（蒙古英文）
      "https://orient.tm/en/feed/",                                 // ASH 阿什哈巴德（土库曼英文）
    ],
    tech: ["https://www.theverge.com/rss/index.xml"],
    finance: ["https://www.cnbc.com/id/10001147/device/rss/rss.html"],
    sports: ["https://www.espn.com/espn/rss/news"],
    entertainment: ["https://variety.com/feed/"],
    health: ["https://feeds.bbci.co.uk/news/health/rss.xml"],
    science: ["https://www.sciencedaily.com/rss/all.xml"],
  },
  ja: {
    // cov20：ja 首次接入真实 RSS（共同/朝日/每日，服务器实测可达且为当日内容；
    // 构建沙箱不可达，构建期仍回退 mock，运行时由 collect-articles 入库生效）。
    // NHK cat0 feed 已停更（停留在 8 月），弃用。
    world: [
      "https://www.kyodo.co.jp/rss/",
      "https://www.asahi.com/rss/asahi/newsheadlines.rdf",
      "https://mainichi.jp/rss/etc/mainichi-flash.rss",
    ],
  },
  ko: {
    // cov21 扩充（Hani 韩民族 + MBN，服务器实测可达且当日内容）
    world: ["https://www.yna.co.kr/rss/world.xml", "https://www.hani.co.kr/rss/", "https://mbn.co.kr/rss/"],
    tech: ["https://www.yna.co.kr/rss/it.xml"],
    finance: ["https://www.yna.co.kr/rss/economy.xml"],
    sports: ["https://www.yna.co.kr/rss/sports.xml"],
    entertainment: ["https://www.yna.co.kr/rss/entertainment.xml"],
  },
  es: {
    // cov21 拉美源（服务器实测可达且当日内容）：阿根廷 Clarín/Naive/Infobae · 墨西哥 El Financiero/Jornada/Mexico News Daily
    world: [
      "https://feeds.bbci.co.uk/mundo/rss.xml",
      "https://www.clarin.com/rss/lo-ultimo/",
      "https://www.lanacion.com.ar/arcio/rss/",
      "https://www.infobae.com/arc/outboundfeeds/rss/",
      "https://www.elfinanciero.com.mx/rss/",
      "https://www.jornada.com.mx/rss/edicion.xml?v=1",
      "https://mexiconewsdaily.com/feed/",
      // cov30 拉美西语区补充（智利 / 哥伦比亚 / 委内瑞拉）
      "https://www.latercera.com/rss/",
      "https://www.emol.com/rss/",
      "https://www.eltiempo.com/rss",
      "https://www.elespectador.com/rss",
      "https://www.eluniversal.com/rss",
    ],
    tech: ["https://www.xataka.com/index.xml"],
    finance: ["https://www.bolsamania.com/noticias/rss/"],
    sports: ["https://www.marca.com/rss/portada.xml"],
    entertainment: ["https://www.elmundo.es/rss/elmundo/cultura.xml"],
  },
  fr: {
    // cov21 非洲法语源（服务器实测可达且当日内容）：塞内加尔 APS/Le Soleil · 摩洛哥 Hespress FR/Le Site Info/Aujourd'hui
    world: [
      FR24.world,
      "https://www.aps.sn/rss",
      "https://www.lesoleil.sn/rss",
      "https://fr.hespress.com/rss",
      "https://lesiteinfo.com/feed/",
      "https://www.aujourdhui.ma/rss",
    ],
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
  // cov30：葡语（pt-PT）真实 RSS——替代此前回退的 mock 内容
  pt: {
    world: [
      "https://www.publico.pt/rss",
      "https://www.observador.pt/rss/",
      "https://www.rtp.pt/rss",
      "https://www.expresso.pt/rss",
      "https://www.jn.pt/rss",
    ],
    tech: ["https://www.sapo.pt/rss/tecnologia"],
    finance: ["https://www.jornaldenegocios.pt/rss"],
    sports: ["https://www.record.pt/rss", "https://www.ojogo.pt/rss"],
    health: ["https://www.sapo.pt/rss/saude"],
    science: ["https://www.publico.pt/ciencia/rss"],
    culture: ["https://www.sapo.pt/rss/cultura"],
  },
  // cov30：土耳其语（tr-TR）真实 RSS——替代此前回退的 mock 内容
  tr: {
    world: [
      "https://www.aa.com.tr/tr/rss",
      "https://www.sozcu.com.tr/rss",
      "https://www.cumhuriyet.com.tr/rss",
    ],
    finance: ["https://www.dunya.com/rss"],
    sports: ["https://www.fanatik.com.tr/rss"],
    tech: ["https://www.webrazzi.com/feed/"],
    health: ["https://www.ntv.com.tr/saglik.rss"],
    science: ["https://www.ntv.com.tr/bilim.rss"],
    culture: ["https://www.ntv.com.tr/kultur.rss"],
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
  // XML 实体解码（MBN 等源的链接带 &amp;，直接存会得到坏的原文字链）
  link = link.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');

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
// 站点 UA 策略：两类源都存在——YNA 等只认机器人 UA（浏览器 UA 直接 404），
// CBC / Arab News 等反过来挂起或 403 机器人 UA。故先试机器人 UA，
// 失败（非 2xx / 超时 / 无条目）再用标准浏览器 UA 重试一次。
const UA_BOT = "Mozilla/5.0 (GlobalHeadlines/1.0; +https://global-headlines.example.com)";
const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchFeedXml(url: string, ua: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": ua,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchFeed(url: string, locale: Locale, category: RssCat): Promise<Article[]> {
  let xml = await fetchFeedXml(url, UA_BOT);
  if (!xml || !/<item\b|<entry\b/i.test(xml)) xml = await fetchFeedXml(url, UA_BROWSER);
  if (!xml) return [];

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
// 归一化：存量镜像里 historically 有缺 body 的条目（卷内旧数据 / 旧版采集器 / rebuild-mirror.mjs
// 从无 body 列的 DB 重建）。读取时统一补齐，保证下游（文章页 pickQuote / 正文渲染）不踩 undefined。
function normalizeArticle(a: Article): Article {
  if (Array.isArray(a.body) && a.body.length > 0) return a;
  const fallback = a.summary || a.title || "";
  return { ...a, body: [fallback] };
}
function loadJsonDb(): Article[] | null {
  if (jsonDbLoaded) return jsonDb;
  jsonDbLoaded = true;
  try {
    const p = path.join(process.cwd(), "data", "articles.json");
    if (fs.existsSync(p)) {
      jsonDb = (JSON.parse(fs.readFileSync(p, "utf8")) as Article[]).map(normalizeArticle);
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
  const hit = byId.get(id);
  if (hit) return hit;
  // 兜底：直接扫描 articles.json 全量，覆盖未被预热的分类（如 zh 无 RSS 源的 sports/health 等）
  const db = loadJsonDb();
  return db ? db.find((a) => a.id === id) : undefined;
}

// 原创策展文章（data/original 合并进 articles.json，id 形如 rss-orig-*）：
// 供新闻流与详情页按 (locale, category) 注入，确保各分类板块都有原创内容。
export function getOriginalArticles(locale: Locale, category?: Category): Article[] {
  const db = loadJsonDb();
  if (!db) return [];
  return db.filter(
    (a) =>
      a.locale === locale &&
      (category ? a.category === category : true) &&
      (a.id || "").startsWith("rss-orig-")
  );
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
