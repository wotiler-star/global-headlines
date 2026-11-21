// scripts/topic-insight.mjs — 基于站内内容数据反推选题（无 GSC 后台数据时的代理指标）
// 用法：node scripts/topic-insight.mjs [data/articles.json]
// 代理指标：
//   1) 标签频次 → 站内反复投入的主题（编辑判断的"用户需求"代理）
//   2) 主题(baseId)的多语种版本数 → 版本少的主题是"翻译/本地化缺口"
//   3) 分类分布 + 近 7 天产出 → 内容结构
// 注意：这不是 GSC 真实查询词（无后台数据），仅作选题参考，别当流量数据。
import fs from "node:fs";
const file = process.argv[2] || "data/articles.json";
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const all = Array.isArray(raw) ? raw : raw.articles || [];
const arts = all.filter((a) => a.id?.startsWith("rss-orig-") && a.title && a.locale);
const suffix = /-(zh-Hant|zh|en|ja|ko|es|fr|de|it|pt|tr|ru|uk|ar|hi|id|ms|fil|vi|th|my|bn|ur)$/;
const baseId = (id = "") => String(id).replace(suffix, "");

// 1) 标签频次（按 baseId 去重后统计，避免同一主题多语种重复计数）
const seen = new Set();
const tagCount = new Map();
const catCount = new Map();
for (const a of arts) {
  const b = baseId(a.id);
  if (seen.has(b)) continue; // 每个主题只算一次
  seen.add(b);
  for (const t of a.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  catCount.set(a.category || "(无)", (catCount.get(a.category || "(无)") || 0) + 1);
}
console.log(`去重主题数: ${seen.size}`);
console.log("\n=== 高频标签 Top 20（选题热度代理）===");
[...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  .forEach(([t, c], i) => console.log(`${String(i + 1).padStart(2)}. ${t} — ${c} 个主题`));

console.log("\n=== 分类分布 ===");
[...catCount.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(`  ${c}: ${n} 个主题`));

// 2) 主题的多语种版本数（缺口）
const versions = new Map();
for (const a of arts) {
  const b = baseId(a.id);
  if (!versions.has(b)) versions.set(b, new Set());
  versions.get(b).add(a.locale);
}
const MAX_LOCALES = 22; // 主要源语种数
const gaps = [...versions.entries()]
  .map(([b, locs]) => ({ b, n: locs.size, locs: [...locs] }))
  .sort((a, c) => a.n - c.n);
console.log(`\n=== 本地化缺口：版本数最少的主题 Top 15（共 ${MAX_LOCALES} 语种）===`);
gaps.slice(0, 15).forEach((g) => console.log(`  ${g.b} — ${g.n}/${MAX_LOCALES} 语种 [${g.locs.join(",")}]`));

// 3) 近 7 天产出主题
const week = Date.now() - 7 * 86400 * 1000;
const recent = new Set(arts.filter((a) => Number(a.publishedAt || 0) >= week).map((a) => baseId(a.id)));
console.log(`\n=== 近 7 天新主题数: ${recent.size} ===`);
