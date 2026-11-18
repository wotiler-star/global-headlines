// server-only：按真实数据反查一篇原创稿实际存在的语种版本。
// 背景：22 语种架构下，buildArticleAlternates 曾无条件为每篇 rss-orig-* 声明
// 全部语种的 hreflang，并在文章页渲染全部语言切换链接；但原创新稿只有 8 个
// 原文语种，后续译文分批补齐，其余语种对应 URL 实际 404（已线上验证）。
// 这里以 data/articles.json 为单一真相源，只返回「真正可访问且应被索引」的版本。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales, NEW_LOCALES, type Locale } from "@/i18n/config";
import { articleBaseId } from "@/lib/site";

type Row = { id?: string; locale?: string; title?: string; summary?: string };

const TTL = 5 * 60_000;
let cache: { ts: number; rows: Row[] } | null = null;

function loadRows(): Row[] {
  if (cache && Date.now() - cache.ts < TTL) return cache.rows;
  let rows: Row[] = [];
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "articles.json"), "utf8"));
    rows = Array.isArray(raw) ? raw : (raw.articles as Row[]) || [];
  } catch {
    // 数据不可读时返回空表；调用方会退回「只声明自身」的保守方案。
  }
  cache = { ts: Date.now(), rows };
  return rows;
}

const LOCALE_SET = new Set<string>(locales);
const CLONE_SET = new Set<string>(NEW_LOCALES);

// 返回 baseId → 实际存在的语种版本 id。
// 未翻译的英文复读页（clone 语种，标题/摘要与 en 版逐字相同）会被排除：
// 这类页在文章页已输出 noindex，不能作为 hreflang alternate 或可见语言链接。
// 译文补齐后标题/摘要变化，自动重新进入映射，无需改代码。
export function articleVersionMap(id: string): Map<Locale, string> {
  const out = new Map<Locale, string>();
  if (!id.startsWith("rss-orig-")) return out;

  const base = articleBaseId(id);
  const rows = loadRows().filter(
    (r): r is Row & { id: string; locale: string } =>
      !!(r.id && r.locale && LOCALE_SET.has(r.locale) && articleBaseId(r.id) === base)
  );
  if (!rows.length) return out;

  const en = rows.find((r) => r.locale === "en");
  for (const r of rows) {
    if (CLONE_SET.has(r.locale) && en && r.title === en.title && r.summary === en.summary) continue;
    out.set(r.locale as Locale, r.id);
  }
  return out;
}
