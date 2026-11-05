import type { MetadataRoute } from "next";
import { locales, categories, Locale } from "@/i18n/config";
import { getArticles } from "@/data/newsSource";
import { absUrl, buildSitemapAlternates, buildSitemapArticleAlternates } from "@/lib/site";

export const dynamic = "force-static";

// cov47：sitemap 只收录「canonical 指向自身」的 URL。
// 分类页 /?cat=... 的 canonical 指向语言首页，收录它们会产生大量重复内容信号，
// 因此从 sitemap 移除；Google 仍可通过首页导航发现这些栏目。
// lastModified 改用文章真实发布时间，避免每次构建都把全部 URL 标成「刚更新」。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  for (const l of locales) {
    const loc = l as Locale;
    const home = buildSitemapAlternates(loc, "");

    const articleTimes = new Map<string, number>();
    for (const a of await getArticles(loc)) articleTimes.set(a.id, a.publishedAt || 0);
    for (const c of categories) {
      for (const a of await getArticles(loc, c)) articleTimes.set(a.id, a.publishedAt || 0);
    }
    const times = [...articleTimes.values()].filter(Boolean);
    const latest = times.length ? new Date(Math.max(...times)) : undefined;

    urls.push({
      url: absUrl(loc, ""),
      lastModified: latest,
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages: home.languages },
    });

    for (const [id, ts] of articleTimes) {
      const alts = buildSitemapArticleAlternates(loc, id);
      urls.push({
        url: absUrl(loc, `/article/${id}`),
        lastModified: ts ? new Date(ts) : latest,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: { languages: alts.languages },
      });
    }
  }

  return urls;
}
