// Navigation URL helpers (Docker / next start deployment — clean URLs).
// Canonical form carries NO trailing slash: /zh and /zh/article/x serve 200
// directly (verified). Legacy /index.html links still resolve through the
// middleware 307 strip (kept as a safety net for old bookmarks/SEO).
import { Locale } from "@/i18n/config";

export function homeHref(locale: Locale): string {
  return `/${locale}`;
}

export function articleHref(locale: Locale, id: string): string {
  return `/${locale}/article/${id}`;
}

export function categoryHref(locale: Locale, cat: string, query?: string): string {
  const base = `/${locale}`;
  if (cat && cat !== "recommend") {
    return query ? `${base}?cat=${cat}&${query}` : `${base}?cat=${cat}`;
  }
  return query ? `${base}?${query}` : base;
}

// Swap the locale segment of an existing in-app path. Accepts logical routes
// (/zh), clean explicit paths, or legacy /index.html forms; always returns the
// clean canonical target. RSS article ids are per-language, so switching from
// an RSS article falls back to the target-language home instead of a 404.
export function swapLocale(pathname: string, next: Locale, query?: string): string {
  const cleaned = pathname.replace(/index\.html$/, "").replace(/\/+$/, "");
  const seg = cleaned.split("/").filter(Boolean);
  const isRssArticle = seg[1] === "article" && seg[2] && seg[2].indexOf("rss-") === 0;
  const target =
    isRssArticle || !(seg[1] === "article" && seg[2]) ? `/${next}` : `/${next}/article/${seg[2]}`;
  return query ? `${target}?${query}` : target;
}
