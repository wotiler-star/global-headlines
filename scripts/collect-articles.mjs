// 采集文章入数据库（构建 / 启动前）
// ----------------------------------------------------------------------------
// 拉取主流媒体 RSS（6 语言 × 分类），解析为 Article，直接写入「运行时数据库」
// data/global-headlines.sqlite（node:sqlite，与 src/lib/db.ts 完全一致的 schema），
// 同时写 data/articles.json 作为可读镜像，供 rssSource.ts 在 SSR 时优先读取。
//
// 关键修正：此前脚本用 sql.js 写入 data/global_headlines.sqlite（下划线，独立引擎/文件），
// 与运行时 node:sqlite 数据库脱节，导致「采集数据」从未进入「入库」。现统一为同一文件、同一引擎。
//
// 运行：node scripts/collect-articles.mjs
// 链入构建：node scripts/collect-articles.mjs && next build && node scripts/gen-rss.mjs
// 链入启动：node scripts/seed-db.mjs && node scripts/collect-articles.mjs && next start
// ----------------------------------------------------------------------------
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

// ---- 运行时数据库路径（必须与 src/lib/db.ts 的 DB_PATH 保持一致）----
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "global-headlines.sqlite");

// ---- 订阅源地图（与 src/data/rssSource.ts 保持一致；追加少量稳定可达源以丰富内容）----
const FR24 = {
  world: "https://www.france24.com/fr/actualites/rss",
  tech: "https://www.france24.com/fr/rss",
  finance: "https://www.france24.com/fr/economie/rss",
  sports: "https://www.france24.com/fr/sport/rss",
  entertainment: "https://www.france24.com/fr/culture/rss",
  health: "https://www.france24.com/fr/rss",
  science: "https://www.france24.com/fr/environnement/rss",
};
const FEEDS = {
  en: {
    world: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://news.ycombinator.com/rss",
      // cov19 主要大国分站源（服务器实测可达）：俄 TASS · 加 CBC · 沙特 Arab News ·
      // 巴西 G1 · 印度 The Hindu · 南非 SABC · 澳 ABC
      "https://tass.com/rss/v2.xml",
      "https://www.cbc.ca/cmlink/rss-topstories",
      "https://www.arabnews.com/rss",
      "https://g1.globo.com/rss/g1/",
      "https://www.thehindu.com/news/national/feeder/default.rss",
      "https://www.sabcnews.com/sabcnews/feed/",
      "https://www.abc.net.au/news/feed/51120/rss.xml",
      // cov20 分站源：德 DW/明镜 · 意 共和报/AGI/24小时太阳报 · 日 时报(英) · 埃及 DNE/独立报(英)
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
      // cov28 分站源（葡语 / 土耳其 / 东南亚 数据覆盖扩充；英文版稳定可达，与 G1/TASS 同理并入 en 国际桶）
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
    // cov20：ja 首次接入真实 RSS（共同/朝日/每日，服务器实测可达且为当日内容）。
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
    // cov21 拉美源（服务器实测可达且当日内容）：阿根廷 Clarín/La Nación/Infobae · 墨西哥 El Financiero/La Jornada/Mexico News Daily
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

// ---- 解析工具（与 rssSource.ts 的纯函数保持一致）----
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/gi, "'").replace(/&apos;/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function stripHtml(s) {
  return decodeEntities(s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}
function getAttr(block, attr) {
  const m = block.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : "";
}
function matchAll(block, re) {
  const out = []; let m; const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = g.exec(block)) !== null) out.push(m[1]);
  return out;
}
function firstImg(html) { const m = html.match(/<img\b[^>]*src=["']([^"']+)["']/i); return m ? m[1] : ""; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

function parseItem(itemXml, locale, category, feedTitle) {
  let title = stripHtml(getTag(itemXml, "title"));
  if (!title) return null;
  const rawTitle = title;
  let link = getTag(itemXml, "link");
  if (!link) { const hrefs = matchAll(itemXml, /<link\b[^>]*href=["']([^"']+)["']/gi); link = hrefs.find((h) => !/\.xml$/i.test(h)) || hrefs[0] || ""; }
  if (!link) return null;
  // XML 实体解码（MBN 等源的链接带 &amp;，直接存会得到坏的原文字链）
  link = link.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');
  const summaryRaw = getTag(itemXml, "description") || getTag(itemXml, "summary");
  const contentRaw = getTag(itemXml, "content:encoded") || getTag(itemXml, "content");
  const summary = stripHtml(summaryRaw).slice(0, 240);
  const bodyText = contentRaw ? stripHtml(contentRaw) : summary;
  const dateRaw = getTag(itemXml, "pubDate") || getTag(itemXml, "updated") || getTag(itemXml, "published");
  const publishedAt = dateRaw ? Date.parse(dateRaw) || Date.now() : Date.now();
  let image = "";
  const media = itemXml.match(/<media:(?:thumbnail|content)\b[^>]*url=["']([^"']+)["']/i);
  if (media) image = media[1];
  if (!image) {
    const enc = itemXml.match(/<enclosure\b[^>]*type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i) ||
      itemXml.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i);
    if (enc) image = enc[1];
  }
  if (!image) image = firstImg(contentRaw || summaryRaw);
  const tags = matchAll(itemXml, /<category\b[^>]*>([\s\S]*?)<\/category>/gi).map(stripHtml).filter(Boolean);
  const atomTags = tags.length ? tags : matchAll(itemXml, /<category\b[^>]*term=["']([^"']+)["']/gi);
  const finalTags = atomTags.slice(0, 4);
  let source = feedTitle;
  if (feedTitle.toLowerCase().includes("google") && rawTitle.includes(" - ")) {
    const m = rawTitle.match(/^(.*?)\s+-\s+(.+)$/);
    if (m) { title = m[1].trim(); if (!source || source.toLowerCase().includes("google")) source = m[2].trim(); }
  }
  if (feedTitle.toLowerCase().includes("france 24")) {
    source = "France 24";
    if (title.endsWith(" - France 24")) title = title.slice(0, -" - France 24".length).trim();
  }
  if (!source && link) { try { source = new URL(link).hostname.replace(/^www\./, ""); } catch { source = "RSS"; } }
  const id = `rss-${hashStr(link)}`;
  const images = image ? [image] : [`https://picsum.photos/seed/${id}/600/400`];
  const words = bodyText ? bodyText.split(/\s+/).length : 0;
  const readMinutes = Math.max(2, Math.round(words / 200)) || 3;
  return {
    id, locale, category, title, summary: summary || title,
    body: bodyText ? [bodyText] : [summary || title], source, author: source,
    publishedAt, imageCount: 1, images, tags: finalTags.length ? finalTags : [title],
    readMinutes, sourceUrl: link,
  };
}

// 站点 UA 策略：两类源都存在——YNA 等只认机器人 UA（浏览器 UA 直接 404），
// CBC / Arab News 等反过来挂起或 403 机器人 UA。故先试机器人 UA，
// 失败（非 2xx / 超时 / 无条目）再用标准浏览器 UA 重试一次。
// 超时 4s → 15s：G1 等大 feed（500KB+）4s 内拉不完，曾被静默丢弃。
const UA_BOT = "Mozilla/5.0 (GlobalHeadlines/1.0; +https://www.starteday.com)";
const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchFeedXml(url, ua) {
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

// 带重试的抓取：瞬时失败（ECONNRESET/限流——YNA 就被限过）退避 2s/5s 再试，最多 3 轮。
// 只有「成功且有条目」才算通过；持续失败返回 []（由镜像合并逻辑兜底，不会让源从首页消失）。
async function fetchFeed(url, locale, category) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let xml = await fetchFeedXml(url, UA_BOT);
    if (!xml || !/<item\b|<entry\b/i.test(xml)) xml = await fetchFeedXml(url, UA_BROWSER);
    if (xml && /<item\b|<entry\b/i.test(xml)) {
      let feedTitle = "";
      const ch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
      if (ch) feedTitle = stripHtml(getTag(ch[1], "title"));
      if (!feedTitle) { const fe = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i); if (fe) feedTitle = stripHtml(getTag(fe[1], "title")); }
      const items = matchAll(xml, /<item\b[^>]*>([\s\S]*?)<\/item>/gi);
      const entries = matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi);
      const blocks = items.length ? items : entries;
      const out = [];
      for (const b of blocks) { const a = parseItem(b, locale, category, feedTitle); if (a) out.push(a); }
      if (out.length) return out;
    }
    if (attempt < 2) await new Promise((s) => setTimeout(s, 2000 * (attempt + 1)));
  }
  console.log(`[collect] feed 持续失败（3 次重试）: ${url}`);
  return [];
}

// 归一化：补齐缺 body 的条目（卷内存量旧数据 / rebuild-mirror 历史产物），
// 用 summary/title 兜底，保证文章页 pickQuote 不踩 undefined。合并时统一过一遍，镜像随时间自愈。
function normalizeArticle(a) {
  if (!a || !a.id) return a;
  if (Array.isArray(a.body) && a.body.length > 0) return a;
  return { ...a, body: [a.summary || a.title || ""] };
}

// 镜像合并写入：读入上一次 articles.json，按 id 叠加本次新采集。
// 关键——单个 feed 瞬时失败（被限流/挂起）时不会把该源从首页/地球仪抹掉；
// 同时按「每语言最多 800 条 + 丢弃 14 天前」控体量，防止无限增长。
function mergeMirror(all) {
  let prev = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join("data", "articles.json"), "utf8"));
    if (Array.isArray(raw)) prev = raw;
  } catch { /* 首次运行无镜像 */ }
  const byId = new Map();
  for (const a of prev) if (a && a.id) byId.set(a.id, normalizeArticle(a));
  for (const a of all) if (a && a.id) byId.set(a.id, normalizeArticle(a)); // 新的覆盖旧的（同 id 内容更新）
  const cutoff = Date.now() - 14 * 86400000;
  const byLoc = new Map();
  for (const a of byId.values()) {
    if (a.publishedAt && a.publishedAt < cutoff) continue; // 丢弃 14 天前的旧闻
    if (!byLoc.has(a.locale)) byLoc.set(a.locale, []);
    byLoc.get(a.locale).push(a);
  }
  const final = [];
  for (const list of byLoc.values()) {
    list.sort((x, y) => (y.publishedAt || 0) - (x.publishedAt || 0));
    final.push(...list.slice(0, 800));
  }
  return final;
}

// 打开运行时数据库（与 db.ts 同一文件），确保全字段 schema 存在
function openRuntimeDb() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  // DELETE 模式：沙箱里 next 进程无法创建 WAL 共享内存文件（-wal/-shm），
  // DELETE 仅事务内生成临时 -journal，无需共享内存，单连接下无并发损失。
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      source TEXT,
      author TEXT,
      published_at INTEGER NOT NULL,
      image_count INTEGER NOT NULL,
      images TEXT NOT NULL,
      tags TEXT,
      read_minutes INTEGER,
      media TEXT,
      video_platform TEXT,
      video_id TEXT,
      source_url TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_articles_locale ON articles(locale);
    CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(locale, category);
  `);
  // 兼容旧库（运行时 db.ts 可能先以旧 schema 建表），补齐新列
  for (const col of ["pinned INTEGER NOT NULL DEFAULT 0", "deleted INTEGER NOT NULL DEFAULT 0"]) {
    try { db.exec(`ALTER TABLE articles ADD COLUMN ${col};`); } catch { /* 已存在则忽略 */ }
  }
  return db;
}

async function main() {
  const all = [];
  const seen = new Set();
  for (const locale of Object.keys(FEEDS)) {
    const catMap = FEEDS[locale];
    const cats = Object.keys(catMap);
    const perCat = cats.map((c) =>
      Promise.all(catMap[c].map((u) => fetchFeed(u, locale, c).catch(() => []))).then((r) => r.flat())
    );
    const results = await Promise.all(perCat);
    let count = 0;
    results.forEach((arts, i) => {
      const c = cats[i];
      for (const a of arts) {
        if (a.sourceUrl && seen.has(a.sourceUrl)) continue;
        if (a.sourceUrl) seen.add(a.sourceUrl);
        all.push(a);
        count++;
      }
    });
    console.log(`[collect] ${locale}: ${count} 条`);
  }

  if (all.length === 0) {
    // 网络不通：保留上一次成功生成的数据库（离线持久化），不覆盖为空。
    console.log("[collect] 未采集到任何文章（可能网络不通），保留已有数据库（如有）。");
    return;
  }

  fs.mkdirSync("data", { recursive: true });

  // JSON 镜像（供 rssSource.ts SSR 优先读取，支持离线重建）——合并写入，见 mergeMirror
  const mirror = mergeMirror(all);
  fs.writeFileSync("data/articles.json", JSON.stringify(mirror, null, 2));
  console.log(`[collect] 写入 data/articles.json（合并后 ${mirror.length} 条，本次新采 ${all.length} 条）`);

  // 直接写入运行时数据库（node:sqlite，INSERT OR REPLACE 按 id 去重/更新，不破坏既有 mock 数据）
  const db = openRuntimeDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO articles
     (id, locale, category, title, summary, source, author, published_at, image_count, images, tags, read_minutes, media, video_platform, video_id, source_url, pinned, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  );
  const tx = db.prepare("BEGIN");
  const commit = db.prepare("COMMIT");
  tx.run();
  for (const a of all) {
    stmt.run(
      a.id, a.locale, a.category, a.title, a.summary, a.source, a.author,
      a.publishedAt, a.imageCount, JSON.stringify(a.images), JSON.stringify(a.tags),
      a.readMinutes, null, null, null, a.sourceUrl
    );
  }
  commit.run();

  const total = db.prepare("SELECT COUNT(*) AS c FROM articles WHERE deleted = 0").get().c;
  console.log(`[collect] 写入 data/global-headlines.sqlite（本次 +${all.length} 条，库内有效文章共 ${total} 条）✅`);

  // 简单自校验
  const row = db.prepare("SELECT locale, COUNT(*) AS n FROM articles WHERE deleted = 0 GROUP BY locale ORDER BY n DESC").all();
  console.log("[collect] 各语言分布:", JSON.stringify(row.map((r) => `${r.locale}:${r.n}`).join(" ")));
  db.close();
}

main().catch((e) => { console.error("[collect] 失败:", e); process.exit(1); });
