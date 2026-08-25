// Navigation URL helpers for CloudStudio static hosting.
//
// CloudStudio only serves EXPLICIT files (e.g. /zh/index.html). Clean directory
// URLs (/zh/) are NOT resolved to index.html — instead they fall back to the root
// index.html (our redirect). So every in-app <Link> must point at the concrete
// index.html file, otherwise navigation would loop through the root redirect.
import { Locale } from "@/i18n/config";

export function homeHref(locale: Locale): string {
  return `/${locale}/index.html`;
}

export function articleHref(locale: Locale, id: string): string {
  return `/${locale}/article/${id}/index.html`;
}

export function categoryHref(locale: Locale, cat: string, query?: string): string {
  const base = `/${locale}/index.html`;
  if (cat && cat !== "recommend") {
    return query ? `${base}?cat=${cat}&${query}` : `${base}?cat=${cat}`;
  }
  return query ? `${base}?${query}` : base;
}

// Swap the locale segment of an existing in-app path and ALWAYS return the
// explicit index.html file — CloudStudio only serves explicit files, so a clean
// path like /en would 404 there. Works whether the incoming pathname is a logical
// route (/zh) or already explicit (/zh/index.html, /zh/article/<id>/index.html).
// Pass `query` (e.g. "cat=world") to preserve filters across a language switch.
export function swapLocale(pathname: string, next: Locale, query?: string): string {
  const cleaned = pathname.replace(/index\.html$/, "");
  const seg = cleaned.split("/").filter(Boolean);
  // RSS articles are collected per-language with independent ids, so a same-id
  // article page does NOT exist in other locales. Switching languages from an RSS
  // article falls back to the target-language home (always exists) instead of 404.
  const isRssArticle = seg[1] === "article" && seg[2]?.startsWith("rss-");
  const explicit = isRssArticle
    ? `/${next}/index.html`
    : seg[1] === "article" && seg[2]
      ? `/${next}/article/${seg[2]}/index.html`
      : `/${next}/index.html`;
  return query ? `${explicit}?${query}` : explicit;
}
