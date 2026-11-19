// 构建期脚本：把全部简体原创稿（locale=zh，基础 id）转成繁體中文（locale=zh-Hant）。
// 用 opencc s→t 转换所有可见中文文本字段（title/summary/tags/body/source/author），
// 中文以外的技术词（SLAM、AR、英文缩写）opencc 会自动保留。运行时零 opencc 依赖。
// 幂等：先移除旧的 premium-zh-Hant-*.json 再重建。
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Converter } from "opencc-js";

const ROOT = process.cwd();
const DIR = join(ROOT, "data", "original");
const s2t = Converter({ from: "cn", to: "tw" });

// 读取所有简体原创稿（premium-2026-11*.json，locale=zh，基础 id 无语种后缀）
const zhFiles = readdirSync(DIR).filter((f) => /^premium-2026-11.*\.json$/.test(f));
const seen = new Set();
const articles = [];
for (const f of zhFiles) {
  const arr = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  if (!Array.isArray(arr)) continue;
  for (const a of arr) {
    if (!a || !a.id || a.locale !== "zh" || !String(a.id).startsWith("rss-orig-")) continue;
    // 排除已带后缀的（正常不该出现）
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    articles.push(a);
  }
}
console.log(`简体原创稿: ${articles.length} 篇 (来自 ${zhFiles.length} 个文件)`);

function convert(a) {
  const id = `${a.id}-zh-Hant`;
  return {
    ...a,
    id,
    locale: "zh-Hant",
    title: s2t(a.title || ""),
    summary: s2t(a.summary || ""),
    tags: Array.isArray(a.tags) ? a.tags.map((t) => s2t(t)) : a.tags,
    body: Array.isArray(a.body) ? a.body.map((p) => s2t(p)) : a.body,
    source: typeof a.source === "string" ? s2t(a.source) : a.source,
    author: typeof a.author === "string" ? s2t(a.author) : a.author,
    category: a.category, // 分类 key 是英文稳定键，不翻译
  };
}

const out = articles.map(convert);

// 清理旧的繁体文件（幂等）
for (const f of readdirSync(DIR)) {
  if (/^premium-zh-Hant-2026-11.*\.json$/.test(f)) unlinkSync(join(DIR, f));
}

const outFile = join(DIR, "premium-zh-Hant-2026-11.json");
writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
console.log(`写出 ${outFile} (${out.length} 篇)`);
if (out.length) {
  const s = out[0];
  console.log("样例 id:", s.id, "| locale:", s.locale);
  console.log("样例 title:", s.title);
  console.log("样例 tags:", JSON.stringify(s.tags));
}
