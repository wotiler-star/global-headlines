import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { Locale, isLocale, isCategory } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getHotBoard } from "@/services/feed";
import SearchExtras from "@/components/SearchExtras";
import SearchResults from "@/components/SearchResults";
import SearchHotBoard from "@/components/SearchHotBoard";
import SearchBox from "@/components/SearchBox";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { homeHref } from "@/lib/paths";
import { buildAlternates, absUrl, SITE_URL } from "@/lib/site";
import { FAQ } from "@/i18n/faq";
import { BRAND_NAME } from "@/lib/brand";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

// 搜索结果页（带 q）不进索引（内容随查询变化、易成薄/重复页）；
// 但 bare /search 落地页可索引、承载 8 语种 hreflang 集群与 FAQ，让站点搜索入口可被收录。
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const loc: Locale = isLocale(locale) ? locale : "zh";
  const d = getDict(loc);
  const q = (sp.q || "").trim();
  const alts = buildAlternates(loc, "/search");
  if (!q) {
    // 落地页：可索引 + 完整 hreflang 集群 + 本地化描述（与首页区分）
    return {
      title: `${d.searchResults} · ${d.siteName}`,
      description: FAQ[loc].landingDesc,
      alternates: { canonical: alts.canonical, languages: alts.languages },
      robots: { index: true, follow: true },
    };
  }
  // 结果页：不索引，canonical 收敛到 bare /search（避免每个 ?q= 产生软 404/重复），
  // 不声明 hreflang（Google 对 noindex 页忽略 hreflang，无需浪费）。
  return {
    title: `${q} - ${d.searchResults}`,
    alternates: { canonical: absUrl(loc, "/search") },
    robots: { index: false, follow: true },
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serialize(a: DbArticle) {
  return {
    id: a.id,
    locale: a.locale,
    category: a.category,
    title: a.title,
    summary: a.summary,
    source: a.source,
    author: a.author,
    publishedAt: a.published_at,
    imageCount: a.image_count,
    images: JSON.parse(a.images || "[]"),
    tags: JSON.parse(a.tags || "[]"),
    readMinutes: a.read_minutes,
    media: a.media,
    videoPlatform: a.video_platform,
    videoId: a.video_id,
    sourceUrl: a.source_url,
    commentCount: (a as any).comment_count || 0,
  };
}

// 搜索结果式结果页：顶部搜索框行 + 左（分类 tab + 排序 + 结果）/ 右（热榜 + 搜索历史）两栏。
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; cat?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const loc: Locale = isLocale(locale) ? locale : "zh";
  const d = getDict(loc);
  const q = (sp.q || "").trim();
  const cat = sp.cat && isCategory(sp.cat) ? sp.cat : "all";
  const sort = sp.sort === "new" ? "new" : "rel";

  let articles: any[] = [];
  if (q) {
    const rows = queryArticles(getDb(), {
      locale: loc,
      q,
      category: cat !== "all" ? cat : undefined,
      orderBy: sort === "new" ? "new" : undefined,
      limit: 24,
      offset: 0,
    });
    articles = rows.map(serialize);
  }
  const hot = await getHotBoard(loc, 10);

  return (
    <main className="search-page container">
      <div className="sp-top">
        <Link prefetch={false} href={homeHref(loc)} className="sp-logo" aria-label={`${BRAND_NAME} home`}>
          <BrandMark size={34} />
          <BrandWordmark />
        </Link>
        <Suspense
          fallback={<div className="search-box sb-hero" style={{ flex: 1, maxWidth: 640 }} />}
        >
          <SearchBox locale={loc} variant="hero" />
        </Suspense>
      </div>
      <div className="sp-layout">
        <div className="sp-main">
          {!q ? (
            <>
              <div className="search-empty">{d.searchEmpty}</div>
              {/* 可见 FAQ：既充实 bare /search 落地页内容（使其值得索引），
                  又作为 FAQPage 结构化数据的 DOM 来源，schema 必须与此处一致。 */}
              <section className="search-faq" aria-label={FAQ[loc].title}>
                <h2 className="sf-title">{FAQ[loc].title}</h2>
                <ul className="sf-list">
                  {FAQ[loc].items.map((it, i) => (
                    <li className="sf-item" key={i}>
                      <h3 className="sf-q">{it.q}</h3>
                      <p className="sf-a">{it.a}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: FAQ[loc].items.map((it) => ({
                      "@type": "Question",
                      name: it.q,
                      acceptedAnswer: { "@type": "Answer", text: it.a },
                    })),
                  }),
                }}
              />
            </>
          ) : (
            // 有 q 就保持 SearchResults 挂载（即使当前分类 0 结果）：
            // 分类 tab 常驻，键盘/鼠标都能从无结果状态切到别的分类，不会被困住。
            <SearchResults locale={loc} q={q} cat={cat} sort={sort} initial={articles} />
          )}
        </div>
        <aside className="sp-side">
          <SearchHotBoard locale={loc} initial={hot} />
          <SearchExtras locale={loc} q={q} />
        </aside>
      </div>
    </main>
  );
}
