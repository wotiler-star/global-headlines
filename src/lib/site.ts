import { locales, defaultLocale, localeMeta, localeRegions, Locale } from "@/i18n/config";

// 规范域：必须与对外实际访问域名一致。历史默认值误写为 www 版，导致 canonical /
// sitemap / hreflang 全部指向 www.starteday.com，而站点对外用 starteday.com，
// 形成规范域分裂（重复内容、权重分散）。统一为裸域，nginx 层把 www 301 过来。
// 构建期经 Dockerfile ARG/ENV 注入（sitemap/canonical 为静态生成，运行期注入无效）。
export const SITE_URL =
  (process.env.SITE_URL || "https://starteday.com").replace(/\/+$/, "");

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

// 生成 hreflang alternate 映射 + canonical，供 generateMetadata 使用。
// 每个语言声明其全部地区变体（language-REGION / language-Script），
// 让不同国家/地区的搜索结果优先命中对应语言版本；x-default 指向默认语言。
// 每个语言页都调用本函数 → 所有变体双向声明，满足 hreflang return-tag 要求。
export function buildAlternates(locale: Locale, path = "") {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    const url = absUrl(l, path);
    languages[localeMeta[l].hreflang] = url;
    for (const region of localeRegions[l]) {
      if (region !== localeMeta[l].hreflang) languages[region] = url;
    }
  }
  languages["x-default"] = absUrl(defaultLocale, path);
  return {
    canonical: absUrl(locale, path),
    languages,
  };
}

// sitemap 专用精简版：每个 URL 只声明 8 个主 hreflang + x-default。
// 原因：站点 4000+ URL，若每条都带 ~60 个地区变体，sitemap 会从 4.6MB 膨胀到
// ~30MB，浪费抓取预算。地区级 hreflang 已在每个页面 <head> 里完整声明（Google 的
// 首选位置），sitemap 只承担 URL 发现与基础语言映射，二者不冲突。
export function buildSitemapAlternates(locale: Locale, path = "") {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeMeta[l].hreflang] = absUrl(l, path);
  languages["x-default"] = absUrl(defaultLocale, path);
  return { canonical: absUrl(locale, path), languages };
}
