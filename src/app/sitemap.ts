import type { MetadataRoute } from "next";
import { locales, categories, Locale } from "@/i18n/config";
import { getArticles } from "@/data/newsSource";
import { absUrl, buildSitemapAlternates, buildSitemapArticleAlternates } from "@/lib/site";

export const dynamic = "force-static";

// cov62：sitemap 收录「canonical 指向自身」的 URL（首页 / 文章 / 静态栏目页）。
// 旧版 /?cat=... 参数页的 canonical 指向语言首页，属重复内容信号曾被排除；
// 现改为静态栏目页 /<locale>/category/<cat>，拥有独立 canonical，正常收录。
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

    // cov62：静态栏目页（recommend 即首页，不重复收录）。
    // 仅收录「该语种确有内容」的栏目：空栏目无内容，提交到 sitemap 反而触发 Google
    // 对「thin/soft-404」URL 的负面信号；空栏目仍保留静态页（内部导航可达），只是不进 sitemap。
    const catsWithContent = new Set((await getArticles(loc)).map((a) => a.category));
    for (const c of categories) {
      if (c === "recommend") continue;
      if (!catsWithContent.has(c)) continue;
      const alts = buildSitemapAlternates(loc, `/category/${c}`);
      urls.push({
        url: absUrl(loc, `/category/${c}`),
        lastModified: latest,
        changeFrequency: "daily",
        priority: 0.7,
        alternates: { languages: alts.languages },
      });
    }

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
