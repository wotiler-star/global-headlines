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
  // Next 默认 trailingSlash:false：/zh/ 会 308 到 /zh。
  // canonical/hreflang/sitemap 必须指向真正返回 200 的 URL，否则形成
  // 「规范链重定向」，Google 会弱化该信号。统一为无尾斜杠。
  const full = `/${locale}${p}`.replace(/\/+$/, "");
  return full + query;
}

export function absUrl(locale: Locale, path = "") {
  return SITE_URL + localePath(locale, path);
}

// 生成 hreflang alternate 映射 + canonical，供 generateMetadata 使用。
// 每个语言声明其全部地区变体（language-REGION / language-Script），
// 让不同国家/地区的搜索结果优先命中对应语言版本；x-default 指向默认语言。
// 每个语言页都调用本函数 → 所有变体双向声明，满足 hreflang return-tag 要求。
export function buildAlternates(locale: Locale, path = "", includeLocales?: readonly Locale[]) {
  const languages: Record<string, string> = {};
  for (const l of includeLocales ?? locales) {
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

// 原创稿（rss-orig-*）每个主题都有多份独立撰写的本地化版本：
// 简体中文（默认 locale）用基础 id，其余语种为 <baseId>-<lang>（繁体为 -zh-Hant）。
// 非原创稿仍按「跨语言共享 id」处理。
export function articleBaseId(id: string) {
  const m = /^(.*)-(en|ja|ko|es|fr|de|it|pt|tr|ru|uk|ar|hi|id|ms|fil|vi|th|my|bn|ur|zh-Hant)$/.exec(id);
  return m ? m[1] : id;
}

// 供文章页渲染「其他语言版本」可见内链：中文用 baseId，其余语种加后缀
export function articleVersionId(baseId: string, l: Locale) {
  return articleIdFor(baseId, l);
}

function articleIdFor(baseId: string, l: Locale) {
  return l === defaultLocale ? baseId : `${baseId}-${l}`;
}

// 返回该稿真实存在的语种 → 文章路径。versions 来自 articleVersions.ts（按 data/articles.json
// 反查）；未传时退回旧的「按 id 后缀推导」兜底（数据文件缺失的极端情况）。
// 非原创稿返回 null（内容不翻译，不能声明多语言版本）。
// 注意：当前页自身必须出现在映射里，否则 canonical 页会丢失自己的 hreflang。
function articleUrlMap(
  id: string,
  locale: Locale,
  versions?: Map<Locale, string> | null
): Record<Locale, string> | null {
  if (!id.startsWith("rss-orig-")) return null;
  const map: Partial<Record<Locale, string>> = {};
  if (versions && versions.size) {
    for (const [l, aid] of versions) map[l] = `/article/${aid}`;
  } else {
    const base = articleBaseId(id);
    for (const l of locales) map[l] = `/article/${articleIdFor(base, l)}`;
  }
  if (!map[locale]) map[locale] = `/article/${id}`;
  return map as Record<Locale, string>;
}

// x-default 指向真正存在的默认语种版本；zh 版缺失时退到任一实际存在的版本，
// 避免历史上 x-default 指向 /zh/article/<不存在的 id> 的死链。
function defaultLanguageUrl(map: Record<Locale, string>): string {
  if (map[defaultLocale]) return absUrl(defaultLocale, map[defaultLocale]);
  const first = (Object.keys(map) as Locale[]).find((l) => !!map[l]);
  return first ? absUrl(first, map[first]) : absUrl(defaultLocale, "");
}

// 文章页专用：只声明真实存在的语种版本，地区级 hreflang 双向互链。
// 同一主题的所有语言页都会生成完全相同的 languages 映射 + 各自 canonical，
// 满足 hreflang return-tag 要求；未翻译的英文复读页不参与，避免指向 noindex 页。
export function buildArticleAlternates(
  locale: Locale,
  id: string,
  versions?: Map<Locale, string> | null
) {
  const path = `/article/${id}`;
  const map = articleUrlMap(id, locale, versions);
  if (!map) {
    const url = absUrl(locale, path);
    return {
      canonical: url,
      languages: { [localeMeta[locale].hreflang]: url, "x-default": url },
    };
  }
  const languages: Record<string, string> = {};
  for (const l of Object.keys(map) as Locale[]) {
    const url = absUrl(l, map[l]);
    languages[localeMeta[l].hreflang] = url;
    for (const region of localeRegions[l]) {
      if (region !== localeMeta[l].hreflang) languages[region] = url;
    }
  }
  languages["x-default"] = defaultLanguageUrl(map);
  return { canonical: absUrl(locale, path), languages };
}

// sitemap 专用精简版：只列真实存在的语种主 hreflang + x-default，避免 6000+ URL × 22 变体膨胀。
export function buildSitemapArticleAlternates(
  locale: Locale,
  id: string,
  versions?: Map<Locale, string> | null
) {
  const path = `/article/${id}`;
  const map = articleUrlMap(id, locale, versions);
  if (!map) {
    const url = absUrl(locale, path);
    return {
      canonical: url,
      languages: { [localeMeta[locale].hreflang]: url, "x-default": url },
    };
  }
  const languages: Record<string, string> = {};
  for (const l of Object.keys(map) as Locale[]) languages[localeMeta[l].hreflang] = absUrl(l, map[l]);
  languages["x-default"] = defaultLanguageUrl(map);
  return { canonical: absUrl(locale, path), languages };
}
