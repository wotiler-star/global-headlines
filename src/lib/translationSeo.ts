// 未翻译的「克隆语种」文章判定：给 SEO 用（noindex + sitemap 排除）。
// 背景：ms/fil/vi/th/my/bn/ur 七个新语种的原创稿在真实译文补齐前，
// 正文/标题直接复用了英文原文，与英文版 100% 重复。这类页面若被索引，
// 会被 Google 判为重复内容，稀释站点质量信号、浪费抓取预算。
// 判定原则：内容比对而非语种白名单——译文补齐后标题/正文不再与英文相同，
// 本函数自动返回 false，页面自动恢复 index，无需改代码。
import type { Article } from "@/data/news";
import { getArticle } from "@/data/newsSource";
import { articleBaseId } from "@/lib/site";
import { NEW_LOCALES, type Locale } from "@/i18n/config";

const CLONE_LOCALES = new Set<string>(NEW_LOCALES);

// 该文章是否为「未翻译的英文复读」：
// 仅克隆语种 + rss-orig-* 原创稿参与；与英文版逐字比对标题和摘要。
// 同步版：调用方需先拿到英文版文章传入（避免页面/站点图各自重复查库）。
export function isEnglishClone(article: Article, enArticle: Article | undefined): boolean {
  if (!CLONE_LOCALES.has(article.locale)) return false;
  if (!article.id.startsWith("rss-orig-")) return false;
  if (!enArticle) return false; // 找不到英文版，保守放行，避免误伤
  return enArticle.title === article.title && enArticle.summary === article.summary;
}

// 异步便捷版：自行按 base id 取英文版（`rss-orig-<concept>-<locale>` -> `-en`）。
export async function isEnglishCloneAsync(article: Article): Promise<boolean> {
  if (!CLONE_LOCALES.has(article.locale) || !article.id.startsWith("rss-orig-")) return false;
  const enId = `${articleBaseId(article.id)}-en`;
  const en = await getArticle("en" as Locale, enId);
  return isEnglishClone(article, en);
}

export function isCloneLocale(locale: string): boolean {
  return CLONE_LOCALES.has(locale);
}
