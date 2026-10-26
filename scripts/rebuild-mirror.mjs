// 从运行时 DB 重建 data/articles.json 镜像。
// 用途：镜像被「本次新采」整体覆盖后（某个源采集失败会把该源从首页/地球抹掉），
//       用 DB 里的累积数据修复。此后由 collect-articles.mjs 的合并逻辑日常维护。
// 只重建 RSS 采集文章（id rss-*，排除用户稿件——那些由 injectUserArticles 单独注入）；
// 原创策展文章（rss-orig-*）随后由 merge-originals.mjs 重新合并进来。
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "global-headlines.sqlite");
const OUT = path.join(process.cwd(), "data", "articles.json");
const db = new DatabaseSync(DB_PATH);
const rows = db
  .prepare("SELECT * FROM articles WHERE deleted = 0 AND id LIKE 'rss-%' AND owner_id IS NULL")
  .all();
const cutoff = Date.now() - 14 * 86400000;
const byLoc = new Map();
for (const r of rows) {
  if (r.published_at && r.published_at < cutoff) continue;
  const images = JSON.parse(r.images || "[]");
  const tags = JSON.parse(r.tags || "[]");
  const a = {
    id: r.id,
    locale: r.locale,
    category: r.category,
    title: r.title,
    summary: r.summary || "",
    // DB 无 body 列：用 summary/title 兜底补上，避免文章页 pickQuote 踩 undefined 打 500
    body: [r.summary || r.title || ""],
    source: r.source || "",
    author: r.author || "",
    publishedAt: r.published_at,
    imageCount: images.length >= 3 ? 3 : 1,
    images,
    tags,
    readMinutes: r.read_minutes || 2,
    ...(r.source_url ? { sourceUrl: r.source_url } : {}),
  };
  if (!byLoc.has(a.locale)) byLoc.set(a.locale, []);
  byLoc.get(a.locale).push(a);
}
const final = [];
for (const list of byLoc.values()) {
  list.sort((x, y) => (y.publishedAt || 0) - (x.publishedAt || 0));
  final.push(...list.slice(0, 800));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(final, null, 2));
console.log(`[rebuild-mirror] 镜像 ${final.length} 条（DB rss-* ${rows.length} 条，每语言 800 上限 + 14 天窗口）`);
