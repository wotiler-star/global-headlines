import { isLocale, Locale, locales, categories, isCategory, Category, ogLocale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticles } from "@/data/newsSource";
import { absUrl, buildAlternates } from "@/lib/site";
import NewsCard from "@/components/NewsCard";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// cov62：静态栏目落地页 /<locale>/category/<cat>。
// 取代旧版 /<locale>?cat=<cat> 参数页——后者 canonical 指向首页被 Google 判为重复内容，
// 42 个栏目长期「已发现-尚未编入索引」。本页拥有独立 canonical + 68 个 hreflang + ItemList /
// BreadcrumbList 结构化数据，可被正常收录。recommend 不在此建页（它即语言首页）。
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const params: { locale: string; cat: string }[] = [];
  for (const l of locales) {
    for (const c of categories) {
      if (c === "recommend") continue;
      params.push({ locale: l, cat: c });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; cat: string }>;
}): Promise<Metadata> {
  const { locale, cat } = await params;
  const loc = locale as Locale;
  const c = cat as Category;
  if (!isLocale(loc) || !isCategory(c) || c === "recommend") return {};
  const d = getDict(loc);
  const catName = d.categories[c];
  const pageTitle = `${catName} · ${d.siteName}`;
  const pageDesc = `${catName} · ${d.homeDesc}`;
  const alts = buildAlternates(loc, `/category/${c}`);
  return {
    title: catName,
    description: pageDesc,
    alternates: { canonical: alts.canonical, languages: alts.languages },
    openGraph: {
      title: pageTitle,
      description: pageDesc,
      url: alts.canonical,
      siteName: d.siteName,
      locale: ogLocale[loc],
      alternateLocale: locales.filter((l) => l !== loc).map((l) => ogLocale[l]),
      type: "website",
      images: [{ url: "/brand/og-cover.png", width: 1200, height: 630, alt: "starteday · 开启每一天" }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDesc,
      images: ["/brand/og-cover.png"],
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; cat: string }>;
}) {
  const { locale, cat } = await params;
  const loc = locale as Locale;
  const c = cat as Category;
  if (!isLocale(loc) || !isCategory(c) || c === "recommend") notFound();

  const d = getDict(loc);
  const catName = d.categories[c];
  // cov62：数据源「按分类查询」对部分栏目（如 world）返回空，但全量流已含各栏目文章
  // （首页 SectionedFeed 即按 category 过滤全量流）。故取全量流后按 category 过滤，
  // 保证栏目页有真实内容、可被 Google 正常收录。视频文章在全量流中已打 category:"video"。
  const articles = (await getArticles(loc)).filter((a) => a.category === c).slice(0, 60);
  const homeUrl = absUrl(loc, "");
  const catUrl = absUrl(loc, `/category/${c}`);

  return (
    <div className="container">
      <div className="cat-page-head">
        <h1 className="cat-page-title">{catName}</h1>
        <p className="cat-page-sub">{d.homeDesc}</p>
      </div>

      {/* ItemList：栏目信息流是可索引列表页，显式标注前 20 条文章（position + url + name），
          帮助 Google 理解列表结构、提升收录与潜在富结果。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: Math.min(articles.length, 20),
            itemListElement: articles.slice(0, 20).map((a, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absUrl(loc, `/article/${a.id}`),
              name: a.title,
            })),
          }),
        }}
      />

      {/* BreadcrumbList：首页 → 栏目，强化栏目页在站点层级中的位置信号。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: d.siteName, item: homeUrl },
              { "@type": "ListItem", position: 2, name: catName, item: catUrl },
            ],
          }),
        }}
      />

      {articles.length === 0 ? (
        <div className="empty">{d.feedEnd}</div>
      ) : (
        <div className="home-section-grid cat-feed">
          {articles.map((a) => (
            <NewsCard key={a.id} article={{ ...a, locale: loc }} />
          ))}
        </div>
      )}
    </div>
  );
}
