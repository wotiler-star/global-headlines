// reset-to-editorial.mjs — cov44 站点内容重置：只保留今天的 3 篇原创策展稿（中英双语共 6 条）
//
// 在容器内执行：docker exec global-headlines node scripts/reset-to-editorial.mjs
// 幂等：重复执行结果不变。保留清单来自 data/original/*.json（原创稿源文件，非采集数据）。
// 同时写 data/.freeze，让采集器（启动管线 / 每 2h cron）跳过采集，避免文章回流。
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const DATA = path.join(process.cwd(), "data");
const MIRROR = path.join(DATA, "articles.json");
const ORIG_DIR = path.join(DATA, "original");
const FREEZE = path.join(DATA, ".freeze");
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(DATA, "global-headlines.sqlite");
const AUDIT = path.join(DATA, "reset-cov44-kept.json");

const raw = JSON.parse(fs.readFileSync(MIRROR, "utf8"));
if (!Array.isArray(raw)) throw new Error("articles.json 不是数组");

// ---- 1. 计算保留清单 ----
const keep = [];
const keepIds = new Set();
if (fs.existsSync(ORIG_DIR)) {
  for (const f of fs.readdirSync(ORIG_DIR).filter((x) => x.endsWith(".json"))) {
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(path.join(ORIG_DIR, f), "utf8")); } catch { continue; }
    for (const o of arr) if (o && o.id) { keep.push(o); keepIds.add(o.id); }
  }
}
// 原创稿源文件缺失时，退回到镜像里现有的 rss-orig-* 条目，绝不执行「零保留」的清空
if (!keep.length) {
  for (const a of raw) if (String(a?.id ?? "").startsWith("rss-orig-")) { keep.push(a); keepIds.add(a.id); }
}
if (!keep.length) throw new Error("找不到任何原创稿，拒绝清空（安全闸门）");

const byId = new Map(raw.map((a) => [a.id, a]));
for (const o of keep) byId.set(o.id, o); // 源文件为准（改稿可生效）
const final = [...keepIds].map((id) => byId.get(id)).filter(Boolean);
fs.writeFileSync(MIRROR, JSON.stringify(final, null, 2));
fs.writeFileSync(AUDIT, JSON.stringify({
  at: new Date().toISOString(),
  keptIds: [...keepIds],
  keptCount: final.length,
  removedFromMirror: raw.length - final.length,
}, null, 2));
console.log(`[reset] articles.json ${raw.length} -> ${final.length}（删除 ${raw.length - final.length} 篇，保留 ${keepIds.size} 个原创 id）`);

// ---- 2. 恢复自动内容更新（cov45：采集器已改精选模式，不再依赖 .freeze）----
if (fs.existsSync(FREEZE)) fs.rmSync(FREEZE);
console.log("[reset] 已移除 data/.freeze（内容更新由编辑管线负责）");

// ---- 3. SQLite 只保留原创稿行 ----
if (fs.existsSync(DB_PATH)) {
  const db = new DatabaseSync(DB_PATH);
  const before = db.prepare("SELECT COUNT(*) AS c FROM articles").get().c;
  const placeholders = [...keepIds].map(() => "?").join(",");
  db.prepare(`DELETE FROM articles WHERE id NOT IN (${placeholders})`).run(...keepIds);
  const after = db.prepare("SELECT COUNT(*) AS c FROM articles").get().c;
  console.log(`[reset] SQLite articles ${before} -> ${after}（删除 ${before - after} 行）`);
  db.close();
} else {
  console.log("[reset] 未找到 SQLite，跳过数据库清理");
}
console.log("[reset] 完成 ✅");
