// repair-body.mjs — 一次性修复 data/articles.json 里缺 body 的条目。
// 背景：gh-data 卷内的 articles.json 有历史遗留的 body 缺失条目（旧版采集器无兜底 /
// rebuild-mirror.mjs 从无 body 列的 DB 重建），文章页 pickQuote 踩 undefined 打 500。
// 本脚本用 summary/title 兜底补齐，幂等可重复跑。collect-articles.mjs 的 mergeMirror
// 此后也会归一化（自愈），本脚本用于立即修复存量。
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "data", "articles.json");

let articles;
try {
  articles = JSON.parse(fs.readFileSync(OUT, "utf8"));
} catch (e) {
  console.log("[repair-body] 读取失败（无文件则无需修复）:", e.message);
  process.exit(0);
}
if (!Array.isArray(articles) || articles.length === 0) {
  console.log("[repair-body] 无文章数据，跳过");
  process.exit(0);
}

let fixed = 0;
const repaired = articles.map((a) => {
  if (a && a.id && !(Array.isArray(a.body) && a.body.length > 0)) {
    fixed++;
    return { ...a, body: [a.summary || a.title || ""] };
  }
  return a;
});

if (fixed === 0) {
  console.log(`[repair-body] 无需修复（${articles.length} 条全部有 body）✅`);
  process.exit(0);
}

// 原子写：先写临时文件再替换，避免半截文件
const tmp = OUT + ".tmp";
fs.writeFileSync(tmp, JSON.stringify(repaired, null, 2));
fs.renameSync(tmp, OUT);
console.log(`[repair-body] 修复 ${fixed} 条（共 ${articles.length} 条）✅`);
