// diag_cov43.mjs — 清理后体检：SQLite 里是否还残留「导读==正文」的稿件
// 在容器内执行：docker exec global-headlines node scripts/diag_cov43.mjs
import { DatabaseSync } from "node:sqlite";
import { normalizeText } from "./lead-dup.mjs";

const db = new DatabaseSync("data/global-headlines.sqlite");
const rows = db.prepare(
  "SELECT id, locale, summary, body, status, deleted FROM articles WHERE deleted = 0"
).all();
console.log("[diag] deleted=0 行数:", rows.length);

const pref = {};
for (const r of rows) {
  const p = String(r.id ?? "").slice(0, 9);
  pref[p] = (pref[p] || 0) + 1;
}
console.log("[diag] id 前缀 top8:", JSON.stringify(Object.entries(pref).sort((a, b) => b[1] - a[1]).slice(0, 8)));

let hasBody = 0, dup = 0, noBody = 0;
const samples = [];
for (const r of rows) {
  if (!r.body) { noBody++; continue; }
  hasBody++;
  const s = normalizeText(r.summary);
  const b = normalizeText(r.body);
  if (s && b && s === b) {
    dup++;
    if (samples.length < 5) samples.push([r.id, r.locale, String(r.summary).slice(0, 60)]);
  }
}
console.log(`[diag] body 为空 ${noBody} / 非空 ${hasBody} / 其中导读==正文 ${dup}`);
console.log("[diag] 重复样本:", JSON.stringify(samples));
db.close();
