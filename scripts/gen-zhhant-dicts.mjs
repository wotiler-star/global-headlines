// 构建期脚本：为各「Raw 字典」从简体 zh 块生成静态繁体 zh-Hant 块。
// opencc 只改中文字符，不改 JS 语法（键名、${} 模板、引号、数字、英文都不动），
// 因此可对 zh 字面量文本直接做 s→t 转换后复制为 "zh-Hant" 键，运行时零 opencc 依赖。
// 幂等：已存在 "zh-Hant" 键的块会先被移除再重建，可重复执行。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Converter } from "opencc-js";

const ROOT = process.cwd();
const s2t = Converter({ from: "cn", to: "tw" });

// 从 pos（指向 'zh' 之后的 ':'）开始，找到该属性值的完整字面量区间 [start,end)。
// 支持对象 {}、数组 []、字符串 " ' `，并能跳过字符串/模板内的括号与转义。
function extractValue(source, colonIdx) {
  let i = colonIdx + 1;
  while (i < source.length && /\s/.test(source[i])) i++;
  const start = i;
  const ch = source[i];
  if (ch === '"' || ch === "'" || ch === "`") {
    const quote = ch;
    i++;
    while (i < source.length) {
      if (source[i] === "\\") { i += 2; continue; }
      if (source[i] === quote) { i++; break; }
      i++;
    }
    return [start, i];
  }
  const openChar = ch;
  const closeChar = ch === "{" ? "}" : ch === "[" ? "]" : null;
  if (!closeChar) throw new Error(`不支持的字面量起始字符: ${ch}`);
  let depth = 0;
  let str = null; // 当前字符串/模板引号
  while (i < source.length) {
    const c = source[i];
    if (str) {
      if (c === "\\") { i += 2; continue; }
      if (c === str) str = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; i++; continue; }
    if (c === "/" && source[i + 1] === "/") { // 行注释
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  if (depth !== 0) throw new Error(`括号未闭合 (${openChar}${closeChar}) at ${start}`);
  return [start, i];
}

// 找到第 nth 个行首缩进的 `zh:` 属性（nth 从 0 开始），返回 {keyStart, colonIdx, valStart, valEnd}
function findZhKey(source, nth = 0) {
  const re = /^([ \t]*)zh[ \t]*:/gm;
  let m;
  let count = 0;
  while ((m = re.exec(source))) {
    if (count === nth) {
      const colonIdx = m.index + m[0].length - 1;
      const [valStart, valEnd] = extractValue(source, colonIdx);
      return { keyStart: m.index, indent: m[1], colonIdx, valStart, valEnd };
    }
    count++;
  }
  return null;
}

// 移除已存在的 "zh-Hant": 键（行首缩进，支持带引号或不带引号的键名）
function stripExisting(source) {
  const re = /^([ \t]*)(?:"zh-Hant"|'zh-Hant'|zh-Hant)[ \t]*:/gm;
  let m;
  let removed = 0;
  while ((m = re.exec(source))) {
    const colonIdx = m.index + m[0].length - 1;
    let [vs, ve] = extractValue(source, colonIdx);
    // 吞掉值后面的逗号和换行
    let end = ve;
    if (source[end] === ",") end++;
    while (end < source.length && (source[end] === " " || source[end] === "\t")) end++;
    if (source[end] === "\n") end++;
    // 吞掉该行前缀缩进
    source = source.slice(0, m.index) + source.slice(end);
    removed++;
    re.lastIndex = m.index; // 重新从当前位置扫描
  }
  return { source, removed };
}

function processFile(relPath, keyIndexes, label) {
  const abs = join(ROOT, relPath);
  let source = readFileSync(abs, "utf8");
  const before = source;
  let stripped = stripExisting(source);
  source = stripped.source;

  // 从后往前处理，避免插入导致前面的下标失效
  for (const nth of [...keyIndexes].sort((a, b) => b - a)) {
    const zh = findZhKey(source, nth);
    if (!zh) { console.error(`  [!] ${label} 未找到第 ${nth} 个 zh 键`); continue; }
    const zhValueText = source.slice(zh.valStart, zh.valEnd);
    const hantValueText = s2t(zhValueText);
    // 在 zh 值之后插入 ", " 前缀的繁体键（保持与 zh 相同的缩进）
    const insertAt = zh.valEnd;
    let insert = "";
    // zh 值后通常已有逗号；我们在值结束处插入 ",\n<indent>\"zh-Hant\": <value>"
    if (source[insertAt] === ",") {
      insert = `,\n${zh.indent}"zh-Hant": ${hantValueText}`;
    } else {
      insert = `,\n${zh.indent}"zh-Hant": ${hantValueText}`;
    }
    source = source.slice(0, insertAt) + insert + source.slice(insertAt);
  }
  if (source !== before) {
    writeFileSync(abs, source, "utf8");
    console.log(`  [ok] ${label}: 已生成繁体块 (清理旧键 ${stripped.removed})`);
  } else {
    console.log(`  [--] ${label}: 无变化`);
  }
}

console.log("生成繁体字典块 (opencc s→t)...");

// 每个文件里需要处理的 zh 键序号（有的文件含多个 Raw 字典，如 news.ts）
processFile("src/i18n/dictionaries.ts", [0], "dictionaries.ts / dictRaw");
processFile("src/i18n/faq.ts", [0], "faq.ts / FAQRaw");
processFile("src/i18n/faqQuestions.ts", [0], "faqQuestions.ts / faqCopyRaw");
processFile("src/i18n/citePage.ts", [0], "citePage.ts / citeCopyRaw");
processFile("src/components/GeoLocaleGuard.tsx", [0], "GeoLocaleGuard.tsx / COPYRaw");
processFile("src/components/CurrencyConverter.tsx", [0], "CurrencyConverter.tsx / I18NRaw");
// videoSource 第 0 个 zh 是 VIDEO_QUERY_RAW（必填），第 1 个是 YT_LANG 的 "zh" 代码（不可翻译）
processFile("src/data/videoSource.ts", [0], "videoSource.ts / VIDEO_QUERY_RAW");
processFile("src/data/news.ts", [0, 1, 2, 3], "news.ts / 4 个 Raw 字典");
processFile("src/app/[locale]/about/page.tsx", [0], "about/page.tsx / bylineRaw");

console.log("完成。");
