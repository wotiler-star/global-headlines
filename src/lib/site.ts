import { locales, defaultLocale, localeMeta, Locale } from "@/i18n/config";

export const SITE_URL =
  (process.env.SITE_URL || "https://global-headlines.example.com").replace(/\/$/, "");

export function localePath(locale: Locale, path = ""): string {
  // Split off any query string so it is preserved after we append /index.html.
  const qIndex = path.indexOf("?");
  const query = qIndex >= 0 ? path.slice(qIndex) : "";
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const p = base && !base.startsWith("/") ? `/${base}` : base;
  // CloudStudio static hosting only serves explicit files, so canonical/hreflang
  // URLs must point at the concrete index.html (e.g. /zh/index.html).
  let full = `/${locale}${p}`.replace(/\/+$/, "");
  if (!full.endsWith("/index.html")) full = `${full}/index.html`;
  return full + query;
}

export function absUrl(locale: Locale, path = ""): string {
  return SITE_URL + localePath(locale, path);
}

// 生成 hreflang alternate 映射 + canonical，供 generateMetadata 使用
export function buildAlternates(locale: Locale, path = "") {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[localeMeta[l].hreflang] = absUrl(l, path);
  }
  languages["x-default"] = absUrl(defaultLocale, path);
  return {
    canonical: absUrl(locale, path),
    languages,
  };
}
