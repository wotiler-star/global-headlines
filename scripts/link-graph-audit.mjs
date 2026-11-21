// scripts/link-graph-audit.mjs — 内链图谱审计：统计每篇文章被站内链接指向的次数（入链 in-degree）
// 用法：node scripts/link-graph-audit.mjs [data/articles.json]
// 模拟站内主要内链来源：
//   1) 上一篇/下一篇（同栏目按时间相邻，2 条/篇）
//   2) 同栏目更多 MoreInCategory（同栏目最近 N 条）
//   3) 相关推荐 RelatedPanel（rankRelated 的简化版：同标签+同分类）
//   4) 首页/分类页/标签页列表（NewsCard）——近期文章入链天然高
// 目标：找出入链=0 的孤岛文章，以及 dist 分布，作为「加大内链」的数据依据。
import fs from "node:fs";

const file = process.argv[2] || "data/articles.json";
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const all = Array.isArray(raw) ? raw : raw.articles || [];
// 只统计原创稿（rss-orig-*），mock/采集稿的入链结构不同
const arts = all.filter((a) => a.id?.startsWith("rss-orig-") && a.title && a.locale);
console.log(`原创稿总数: ${arts.length}`);

// baseId：跨语种同一主题归组
const suffix = /-(zh-Hant|zh|en|ja|ko|es|fr|de|it|pt|tr|ru|uk|ar|hi|id|ms|fil|vi|th|my|bn|ur)$/;
const baseId = (id = "") => String(id).replace(suffix, "");

const inDeg = new Map(arts.map((a) => [a.id, 0]));
const add = (id) => { if (inDeg.has(id)) inDeg.set(id, inDeg.get(id) + 1); };

// 0) 多语种版本互相链接（文章页 L447-475 的可见语言切换）——同一 baseId 的所有版本互指
const byBase = new Map();
for (const a of arts) {
  const b = baseId(a.id);
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(a.id);
}
for (const ids of byBase.values()) {
  for (const id of ids) for (const o of ids) if (o !== id) add(o);
}

// 1) 按语种+栏目分组
const byLocCat = new Map();
for (const a of arts) {
  const k = `${a.locale}||${a.category || ""}`;
  if (!byLocCat.has(k)) byLocCat.set(k, []);
  byLocCat.get(k).push(a);
}
for (const group of byLocCat.values()) {
  group.sort((x, y) => Number(y.publishedAt || 0) - Number(x.publishedAt || 0));
  // 上一篇/下一篇
  for (let i = 0; i < group.length; i++) {
    if (i > 0) add(group[i - 1].id);
    if (i < group.length - 1) add(group[i + 1].id);
  }
  // 同栏目更多：每篇指向同栏目最近 6 篇
  for (const a of group) {
    group.slice(0, 6).forEach((o) => { if (o.id !== a.id) add(o.id); });
  }
}

// 2) 相关推荐简化：同 baseId 的其它语种版本 + 同标签
const byTag = new Map();
for (const a of arts) for (const t of a.tags || []) {
  if (!byTag.has(t)) byTag.set(t, []);
  byTag.get(t).push(a.id);
}
for (const a of arts) {
  const tagSet = new Set(a.tags || []);
  const candidates = new Set();
  for (const t of tagSet) (byTag.get(t) || []).forEach((id) => candidates.add(id));
  // 每篇的相关推荐位约 6 个，按同标签命中数取前 6
  const scored = [...candidates].filter((id) => id !== a.id).map((id) => {
    const o = arts.find((x) => x.id === id);
    const hit = (o?.tags || []).filter((t) => tagSet.has(t)).length;
    return { id, hit };
  }).sort((x, y) => y.hit - x.hit).slice(0, 6);
  scored.forEach(({ id }) => add(id));
}

// 3) 分布统计
const vals = [...inDeg.values()].sort((a, b) => a - b);
const zero = vals.filter((v) => v === 0).length;
const one = vals.filter((v) => v <= 1).length;
const median = vals[Math.floor(vals.length / 2)];
const max = vals[vals.length - 1];
console.log(`入链分布: min=${vals[0]} 中位=${median} max=${max}`);
console.log(`入链=0 的孤岛文章: ${zero} 篇 (${(zero / vals.length * 100).toFixed(1)}%)`);
console.log(`入链<=1 的弱链文章: ${one} 篇 (${(one / vals.length * 100).toFixed(1)}%)`);

const islands = [...inDeg.entries()].filter(([, v]) => v === 0).map(([id]) => id).sort();
if (islands.length) {
  console.log(`\n孤岛文章样例（前 20）:`);
  islands.slice(0, 20).forEach((id) => console.log("  " + id));
}
