import type { MetadataRoute } from "next";
import { locales, categories, Locale } from "@/i18n/config";
import { getArticles } from "@/data/newsSource";
import { absUrl, buildAlternates } from "@/lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  for (const l of locales) {
    const loc = l as Locale;

    // 首页（每个语言独立 URL）
    const home = buildAlternates(loc, "");
    urls.push({ url: absUrl(loc, ""), lastModified: new Date(), alternates: { languages: home.languages } });

    // 分类页
    for (const c of categories) {
      if (c === "recommend") continue;
      const alts = buildAlternates(loc, `/?cat=${c}`);
      urls.push({
        url: absUrl(loc, `/?cat=${c}`),
        lastModified: new Date(),
        alternates: { languages: alts.languages },
      });
    }

    // 文章页：遍历首页流 + 各分类，确保所有被预渲染的文章都被索引
    // （mock 文章跨语言共享 id，只在分类下生成，必须遍历分类才不会漏）
    const articleIds = new Set<string>();
    for (const a of await getArticles(loc)) articleIds.add(a.id);
    for (const c of categories) {
      for (const a of await getArticles(loc, c)) articleIds.add(a.id);
    }
    for (const id of articleIds) {
      const alts = buildAlternates(loc, `/article/${id}`);
      urls.push({
        url: absUrl(loc, `/article/${id}`),
        lastModified: new Date(),
        alternates: { languages: alts.languages },
      });
    }
  }

  return urls;
}
