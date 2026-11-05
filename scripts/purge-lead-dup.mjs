// purge-lead-dup.mjs — 一次性清理存量「导读 == 全文正文」低质量稿（cov43）
//
// 在容器内执行：docker exec global-headlines node scripts/purge-lead-dup.mjs
// 作用：
//   1) 从 data/articles.json 移除命中文章（页面 SSR 的唯一数据源）
//   2) 按 id 从运行时 SQLite 删除对应行（含历史残留的同一批文章）
//   3) 把被删 id 清单写入 data/purged-lead-dup-ids.json，供审计 / 回滚
// 幂等：重复执行命中 0 条，不会二次破坏数据。
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { shouldPurge } from "./lead-dup.mjs";

const DATA = path.join(process.cwd(), "data");
const MIRROR = path.join(DATA, "articles.json");
const IDS = path.join(DATA, "purged-lead-dup-ids.json");
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(DATA, "global-headlines.sqlite");

const raw = JSON.parse(fs.readFileSync(MIRROR, "utf8"));
if (!Array.isArray(raw)) throw new Error("articles.json 不是数组");

const hits = raw.filter(shouldPurge);
const kept = raw.filter((a) => !shouldPurge(a));
const ids = [...new Set(hits.map((a) => a.id).filter(Boolean))];
const byLoc = {};
for (const a of hits) byLoc[a.locale] = (byLoc[a.locale] || 0) + 1;

fs.writeFileSync(MIRROR, JSON.stringify(kept, null, 2));
// 与已有清单合并（幂等累积，便于一次完整回滚）
let allIds = [];
try { allIds = JSON.parse(fs.readFileSync(IDS, "utf8")); } catch { /* 首次 */ }
fs.writeFileSync(IDS, JSON.stringify([...new Set([...allIds, ...ids])], null, 2));
console.log(`[purge] articles.json ${raw.length} -> ${kept.length}，删除 ${hits.length} 条`);
console.log(`[purge] 分语种删除: ${JSON.stringify(byLoc)}`);

if (fs.existsSync(DB_PATH)) {
  const db = new DatabaseSync(DB_PATH);
  const stmt = db.prepare("DELETE FROM articles WHERE id = ?");
  db.prepare("BEGIN").run();
  let removed = 0;
  for (const id of ids) {
    const r = stmt.run(id);
    removed += Number(r?.changes ?? 0);
  }
  db.prepare("COMMIT").run();
  const total = db.prepare("SELECT COUNT(*) AS c FROM articles WHERE deleted = 0").get().c;
  console.log(`[purge] SQLite 删除 ${removed} 行，剩余有效文章 ${total} 条`);
  db.close();
} else {
  console.log("[purge] 未找到 SQLite，跳过数据库清理");
}
console.log("[purge] 完成 ✅");
