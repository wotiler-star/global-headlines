/**
 * SERP 展示层智能截断 (2026-11-23)
 *
 * 背景：文章源标题中位数 86 字符(英文)、摘要中位数 364 字符，远超 Google
 * 搜索结果页的显示宽度（title ~60 拉丁字符 / ~30 CJK 字，description ~155
 * 拉丁 / ~78 CJK）。超长会被搜索引擎粗暴截断在半个词/半句话，损害 CTR。
 *
 * 本模块只在 metadata 层对展示文本做语义感知截断，**不改动任何内容源**，
 * 完全可逆。策略：
 *  1) title：优先在分隔符（: — – | · ：）处断，保留信息量最大的主标题；
 *     其次在词/标点边界断；最后才硬截。
 *  2) description：优先在句末标点（. ! ? 。！？）断成完整句子；
 *     其次在逗号/分号断；最后词边界/硬截。
 *  3) 按语种区分预算（CJK 一个字≈2 个拉丁字符的视觉宽度）。
 * 永不抛异常：任意输入都返回 string。
 */
import type { Locale } from "@/i18n/config";

/** CJK / 全角语种：视觉宽度约为拉丁字符的 2 倍 */
const CJK_LOCALES = new Set<Locale>(["zh", "zh-Hant", "ja", "ko"]);

/**
 * 标题预算：layout 的 title.template 会追加 " · starteday"(约 12 字符)，
 * 故正文预算需预留，避免最终 SERP 标题仍被截断。
 * 拉丁 ~48 字符 + 品牌 ~12 = 60；CJK ~26 字 + 品牌 = 约 32 字宽。
 */
const TITLE_BUDGET = 48;
const TITLE_BUDGET_CJK = 26;
const DESC_BUDGET = 155;
const DESC_BUDGET_CJK = 80;

const SEP_CHARS = /[:：—–|\u00b7·]/g; // 主标题分隔符
const SENT_END = /[.!?。！？…]/g; // 句末标点（保留在截断串内）
const CLAUSE = /[,，;；—–]/g; // 分句标点
const WORD = /\s+/g; // 词边界

function isCJK(loc: Locale): boolean {
  return CJK_LOCALES.has(loc);
}

/** 在预算内找到最后一个「干净」的断点索引；找不到返回 -1 */
function lastBreakBefore(s: string, max: number, pattern: RegExp): number {
  // 只搜前 max 个字符，取最后一个匹配位置
  const head = s.slice(0, max);
  let best = -1;
  for (const m of head.matchAll(pattern)) {
    const idx = (m.index ?? 0) + m[0].length; // 断在匹配之后
    if (idx <= max) best = idx;
  }
  return best;
}

/**
 * 截断标题用于 SERP 展示。保留主标题（冒号/破折号前），不追加品牌——
 * layout 的 title.template 会统一加 " · starteday"，避免双品牌。
 */
export function displayTitle(raw: string, loc: Locale): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  const budget = isCJK(loc) ? TITLE_BUDGET_CJK : TITLE_BUDGET;
  if (s.length <= budget) return s;

  // 1) 优先在分隔符处断，保留第一段主标题（要求主标题本身不太短，避免断成 "The"）
  const head = s.slice(0, budget + 12); // 稍放宽以找到预算内的分隔符
  const sep = lastBreakBefore(head, budget, SEP_CHARS);
  if (sep > 0) {
    const candidate = s.slice(0, sep).trim().replace(/[:：—–|\u00b7·\s]+$/, "");
    // 主标题至少有预算的 30%，才用它；否则视为分隔太靠前，走后续策略
    if (candidate.length >= budget * 0.3) return candidate;
  }

  // 2) 词边界（空格）或标点边界
  const wordCut = lastBreakBefore(s.slice(0, budget), budget, WORD);
  if (wordCut > 0 && wordCut >= budget * 0.5) return s.slice(0, wordCut).trimEnd() + "\u2026";

  // 3) 硬截
  return s.slice(0, budget - 1).trimEnd() + "\u2026";
}

/**
 * 截断摘要用于 meta description / OG / Twitter / JSON-LD description。
 * 优先断成完整句子，避免半句话出现在搜索结果里。
 */
export function displayDescription(raw: string, loc: Locale): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!s) return "";
  const budget = isCJK(loc) ? DESC_BUDGET_CJK : DESC_BUDGET;
  if (s.length <= budget) return s;

  // 1) 句末标点：找预算内最后一个句子结束处（保留标点）
  const sent = lastBreakBefore(s, budget, SENT_END);
  if (sent > 0 && sent >= budget * 0.45) return s.slice(0, sent).trim();

  // 2) 逗号/分号/破折号边界
  const clause = lastBreakBefore(s, budget, CLAUSE);
  if (clause > 0 && clause >= budget * 0.55) {
    return s.slice(0, clause).trim().replace(/[,，;；—–\s]+$/, "") + "\u2022";
  }

  // 3) 词边界
  const wordCut = lastBreakBefore(s.slice(0, budget), budget, WORD);
  if (wordCut > 0 && wordCut >= budget * 0.5) return s.slice(0, wordCut).trimEnd() + "\u2026";

  // 4) 硬截
  return s.slice(0, budget - 1).trimEnd() + "\u2026";
}
