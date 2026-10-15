import { locales, defaultLocale, localeMeta, Locale } from "@/i18n/config";

// 默认值即生产正式域名；构建期经 Dockerfile ARG/ENV 注入（sitemap/canonical 为静态生成，运行期注入无效）
export const SITE_URL =
  (process.env.SITE_URL || "https://www.starteday.com").replace(/\/$/, "");

export function localePath(locale: Locale, path = "") {
  // 拆出查询串，归一化后原样拼回
  const qIndex = path.indexOf("?");
  const query = qIndex >= 0 ? path.slice(qIndex) : "";
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const p = base && !base.startsWith("/") ? `/${base}` : base;
  // Docker(next start) 部署服务干净 URL，不再追加 /index.html（CloudStudio 静态托管遗留逻辑）
  const full = `/${locale}${p}`.replace(/\/+$/, "");
  // 目录型根路径保留尾斜杠（/zh/），其余为干净路径（/zh/article/xxx）
  return (full === `/${locale}` ? `${full}/` : full) + query;
}

export function absUrl(locale: Locale, path = "") {
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
