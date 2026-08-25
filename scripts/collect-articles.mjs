// 采集文章入数据库（构建时）
// ----------------------------------------------------------------------------
// 在 `next build` 之前运行：拉取主流媒体 RSS（6 语言 × 分类），解析为 Article，
// 写入真实 SQLite 数据库 data/global_headlines.sqlite（via sql.js，纯 WASM，无原生编译），
// 同时写 data/articles.json 作为可读镜像。next build 时 rssSource 会优先读这个 JSON 缓存，
// 避免重复联网，且让数据库成为采集结果的「单一真相源」，可离线重建、可检索/审阅。
//
// 运行：node scripts/collect-articles.mjs
// 链入 build：node scripts/collect-articles.mjs && next build && node scripts/gen-rss.mjs
// ----------------------------------------------------------------------------
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");

// ---- 订阅源地图（与 src/data/rssSource.ts 保持一致）----
const FR24 = { world:"https://www.france24.com/fr/actualites/rss", tech:"https://www.france24.com/fr/rss", finance:"https://www.france24.com/fr/economie/rss", sports:"https://www.france24.com/fr/sport/rss", entertainment:"https://www.france24.com/fr/culture/rss", health:"https://www.france24.com/fr/rss", science:"https://www.france24.com/fr/environnement/rss" };
const FEEDS = {
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
    // 构建沙箱网络不可达任何日语音源（NHK/.or.jp、asahi/.com 等超时/失败），回退 mock。
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
  let link = getTag(itemXml, "link");
  if (!link) { const hrefs = matchAll(itemXml, /<link\b[^>]*href=["']([^"']+)["']/gi); link = hrefs.find((h) => !/\.xml$/i.test(h)) || hrefs[0] || ""; }
  if (!link) return null;
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
  if (feedTitle.toLowerCase().includes("google") && title.includes(" - ")) {
    const m = title.match(/^(.*?)\s+-\s+(.+)$/);
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

async function fetchFeed(url, locale, category) {
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
  let feedTitle = "";
  const ch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  if (ch) feedTitle = stripHtml(getTag(ch[1], "title"));
  if (!feedTitle) { const fe = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i); if (fe) feedTitle = stripHtml(getTag(fe[1], "title")); }
  const items = matchAll(xml, /<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  const entries = matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi);
  const blocks = items.length ? items : entries;
  const out = [];
  for (const b of blocks) { const a = parseItem(b, locale, category, feedTitle); if (a) out.push(a); }
  return out;
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

  // JSON 镜像
  fs.writeFileSync("data/articles.json", JSON.stringify(all, null, 2));
  console.log(`[collect] 写入 data/articles.json（${all.length} 条）`);

  // SQLite 数据库
  const SQL = await initSqlJs({ locateFile: (f) => path.join(process.cwd(), "node_modules/sql.js/dist", f) });
  const db = new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    locale TEXT,
    category TEXT,
    title TEXT,
    summary TEXT,
    source TEXT,
    source_url TEXT,
    published_at INTEGER,
    image TEXT,
    tags TEXT,
    url TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_locale ON articles(locale);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cat ON articles(category);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_locale_cat ON articles(locale, category);`);
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO articles (id,locale,category,title,summary,source,source_url,published_at,image,tags,url) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  );
  for (const a of all) {
    stmt.run([a.id, a.locale, a.category, a.title, a.summary, a.source, a.sourceUrl, a.publishedAt, a.images[0] || "", JSON.stringify(a.tags), `/${a.locale}/article/${a.id}`]);
  }
  stmt.free();
  fs.writeFileSync("data/global_headlines.sqlite", Buffer.from(db.export()));
  db.close();
  console.log(`[collect] 写入 data/global_headlines.sqlite（${all.length} 条）✅`);

  // 简单自校验
  const SQL2 = await initSqlJs({ locateFile: (f) => path.join(process.cwd(), "node_modules/sql.js/dist", f) });
  const db2 = new SQL2.Database(fs.readFileSync("data/global_headlines.sqlite"));
  const row = db2.exec("SELECT locale, COUNT(*) AS n FROM articles GROUP BY locale ORDER BY n DESC");
  console.log("[collect] DB 校验:", JSON.stringify(row[0] ? row[0].values : []));
  db2.close();
}

main().catch((e) => { console.error("[collect] 失败:", e); process.exit(1); });
