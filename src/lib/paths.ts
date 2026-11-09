// Navigation URL helpers (Docker / next start deployment — clean URLs).
// Canonical form carries NO trailing slash: /zh and /zh/article/x serve 200
// directly (verified). Legacy /index.html links still resolve through the
// middleware 307 strip (kept as a safety net for old bookmarks/SEO).
import { Locale, isCategory } from "@/i18n/config";

export function homeHref(locale: Locale): string {
  return `/${locale}`;
}

export function articleHref(locale: Locale, id: string): string {
  return `/${locale}/article/${id}`;
}

// cov62：分类页改为静态 URL /<locale>/category/<cat>，替代原先的 /<locale>?cat=<cat>。
// 原因：?cat= 参数页的 canonical 指向语言首页，被 Google 判为重复内容，42 个栏目页
// 长期「已发现-尚未编入索引」。静态路径拥有独立 canonical + 68 hreflang + ItemList 结构
// 化数据，可被正常收录。recommend 仍指回首页（它本身不是独立栏目）。
export function categoryHref(locale: Locale, cat: string, query?: string): string {
  if (cat && cat !== "recommend") {
    return query ? `/${locale}/category/${cat}?${query}` : `/${locale}/category/${cat}`;
  }
  const base = `/${locale}`;
  return query ? `${base}?${query}` : base;
}

// cov63：标签页 /<locale>/tag/<slug> 的 href 由 lib/tags.ts 的 tagHref 统一提供。
// swapLocale 遇到 /tag/xxx 会走默认分支回落到目标语种首页——这正是刻意的：
// tag 文本各语种不同、无跨语种对应版本，保留 slug 会指向不存在的标签页。

// Swap the locale segment of an existing in-app path. Accepts logical routes
// (/zh), clean explicit paths, or legacy /index.html forms; always returns the
// clean canonical target. RSS article ids are per-language, so switching from
// an RSS article falls back to the target-language home instead of a 404.
export function swapLocale(pathname: string, next: Locale, query?: string): string {
  const cleaned = pathname.replace(/index\.html$/, "").replace(/\/+$/, "");
  const seg = cleaned.split("/").filter(Boolean);
  let target: string;
  if (seg[1] === "article" && seg[2]) {
    // RSS 文章 id 按语言生成，跨语言切换回落到目标语言首页而非 404
    target = seg[2].indexOf("rss-") === 0 ? `/${next}` : `/${next}/article/${seg[2]}`;
  } else if (seg[1] === "category" && seg[2] && isCategory(seg[2])) {
    target = `/${next}/category/${seg[2]}`;
  } else {
    target = `/${next}`;
  }
  return query ? `${target}?${query}` : target;
}
