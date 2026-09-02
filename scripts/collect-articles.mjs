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
    ],
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
  const rawTitle = title;
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

  // JSON 镜像（供 rssSource.ts SSR 优先读取，支持离线重建）
  fs.writeFileSync("data/articles.json", JSON.stringify(all, null, 2));
  console.log(`[collect] 写入 data/articles.json（${all.length} 条）`);

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
