import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { Locale, isLocale, isCategory } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getHotBoard } from "@/services/feed";
import SearchExtras from "@/components/SearchExtras";
import SearchResults from "@/components/SearchResults";
import SearchHotBoard from "@/components/SearchHotBoard";
import SearchBox from "@/components/SearchBox";
import { Suspense } from "react";
import type { Metadata } from "next";

// 搜索结果页不进索引（内容随 q 变化），标题带上关键词
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
  return {
    title: q ? `${q} - ${d.searchResults}` : d.searchResults,
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

// 头条搜索式结果页：顶部搜索框行 + 左（分类 tab + 排序 + 结果）/ 右（热榜 + 搜索历史）两栏。
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
        <span className="sp-logo">{d.searchLogo}</span>
        <Suspense
          fallback={<div className="search-box sb-hero" style={{ flex: 1, maxWidth: 640 }} />}
        >
          <SearchBox locale={loc} variant="hero" />
        </Suspense>
      </div>
      <div className="sp-layout">
        <div className="sp-main">
          {!q ? (
            <div className="search-empty">{d.searchEmpty}</div>
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
