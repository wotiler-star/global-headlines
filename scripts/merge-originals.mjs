// 合并「原创策展文章」到构建期数据，使其在 RSS 聚合流 + 详情页中生效。
// 运行链：collect-articles.mjs && merge-originals.mjs && next build && gen-rss.mjs
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const ORIGIN_DIR = path.join(ROOT, "data", "original");
const ARTICLES_JSON = path.join(ROOT, "data", "articles.json");
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(ROOT, "data", "global-headlines.sqlite");

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

function main() {
  let originals = [];
  if (fs.existsSync(ORIGIN_DIR)) {
    for (const f of fs.readdirSync(ORIGIN_DIR)) {
      if (f.endsWith(".json")) {
        const arr = loadJson(path.join(ORIGIN_DIR, f), []);
        if (Array.isArray(arr)) originals.push(...arr);
      }
    }
  }
  if (originals.length === 0) {
    console.log("[merge-originals] 未找到原创文章，跳过。");
    return;
  }

  const base = loadJson(ARTICLES_JSON, []);
  const seen = new Set(base.map((a) => a.id));
  let added = 0;
  for (const o of originals) {
    if (!o || !o.id) continue;
    if (seen.has(o.id)) continue;
    base.push(o);
    seen.add(o.id);
    added++;
  }
  fs.mkdirSync(path.dirname(ARTICLES_JSON), { recursive: true });
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(base, null, 2));
  console.log(`[merge-originals] articles.json 合并 +${added} 篇（库内共 ${base.length} 条）`);

  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec(`CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY, locale TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT, source TEXT, author TEXT,
      published_at INTEGER NOT NULL, image_count INTEGER NOT NULL, images TEXT NOT NULL,
      tags TEXT, read_minutes INTEGER, media TEXT, video_platform TEXT,
      video_id TEXT, source_url TEXT, pinned INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0);`);
    const stmt = db.prepare(`INSERT OR REPLACE INTO articles
      (id, locale, category, title, summary, source, author, published_at, image_count, images, tags, read_minutes, media, video_platform, video_id, source_url, pinned, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`);
    const tx = db.prepare("BEGIN"); const commit = db.prepare("COMMIT");
    tx.run();
    for (const o of originals) {
      stmt.run(
        o.id, o.locale, o.category, o.title, o.summary || "", o.source || "Starteday 原创",
        o.author || "Starteday 编辑部", o.publishedAt || Date.now(), o.imageCount || (o.images ? o.images.length : 1),
        JSON.stringify(o.images || []), JSON.stringify(o.tags || []), o.readMinutes || 3,
        null, null, null, o.sourceUrl || ""
      );
    }
    commit.run();
    db.close();
    console.log(`[merge-originals] SQLite 写入 +${originals.length} 篇`);
  } catch (e) {
    console.warn("[merge-originals] SQLite 同步跳过：", e.message);
  }
}

main();
