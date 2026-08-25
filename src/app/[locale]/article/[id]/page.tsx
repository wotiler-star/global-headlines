import { Suspense } from "react";
import { isLocale, Locale, locales, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticle, getRelated, getArticles } from "@/data/newsSource";
import { formatRelativeTime } from "@/data/news";
import { buildAlternates } from "@/lib/site";
import { videoEmbedSrc } from "@/lib/video";
import { homeHref } from "@/lib/paths";
import CategoryNav from "@/components/CategoryNav";
import RelatedPanel from "@/components/RelatedPanel";
import ReadHistoryTracker from "@/components/ReadHistoryTracker";
import BookmarkButton from "@/components/BookmarkButton";
import FollowButton from "@/components/FollowButton";
import ShareBar from "@/components/ShareBar";
import ReadingProgress from "@/components/ReadingProgress";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const params: { locale: string; id: string }[] = [];
  for (const l of locales) {
    const ids = new Set<string>();
    // 首页流（含 RSS 真实采集 + 视频）保证该语言实际文章都被预渲染
    for (const a of await getArticles(l)) ids.add(a.id);
    // 同时遍历各分类：mock 文章在各分类下生成，且跨语言共享 id，
    // 必须保证每个语言都为这些共享 id 预渲染页面，否则跨语言切换会 404。
    for (const cat of categories) {
      for (const a of await getArticles(l, cat)) ids.add(a.id);
    }
    for (const id of ids) params.push({ locale: l, id });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const loc = locale as Locale;
  const article = await getArticle(loc, id);
  if (!article) return {};
  const alts = buildAlternates(loc, `/article/${id}`);
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      images: [{ url: article.images[0] }],
      type: "article",
    },
    alternates: { canonical: alts.canonical, languages: alts.languages },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) notFound();

  const article = await getArticle(loc, id);
  if (!article) notFound();

  const d = getDict(loc);
  const related = await getRelated(loc, article);
  const videos = article.media === "video"
    ? (await getArticles(loc, "video")).filter((a) => a.id !== article.id).slice(0, 6)
    : [];

  return (
    <>
      <ReadHistoryTracker id={article.id} category={article.category} />
      <Suspense fallback={null}>
        <CategoryNav locale={loc} active={article.category} />
      </Suspense>
      <div className="container">
        <article className="article">
          <ReadingProgress />
          <h1 className="article-title">{article.title}</h1>
          <div className="article-meta">
            <span className="src">{article.source}</span>
            <span>{formatRelativeTime(loc, article.publishedAt, d)}</span>
            <span>{article.readMinutes} min</span>
            <span>{d.categories[article.category]}</span>
          </div>
          <div className="article-actions">
            <FollowButton source={article.source} locale={loc} />
            <BookmarkButton id={article.id} />
            <ShareBar locale={loc} id={article.id} title={article.title} />
          </div>
          <div className="hero">
            {article.media === "video" ? (
              <iframe
                className="hero-video"
                src={videoEmbedSrc(article.videoPlatform, article.videoId)}
                title={article.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.images[0]} alt={article.title} loading="lazy" />
              </>
            )}
          </div>
          <div className="article-body">
            {article.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {article.sourceUrl && (
            <a
              className="read-original"
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {d.readOriginal} <span aria-hidden>&#8599;</span>
            </a>
          )}
          <div className="article-tags">
            <span className="tag-label">{d.tagTitle}：</span>
            {article.tags.map((t, i) => (
              <a key={i} className="tag-chip" href={`${homeHref(loc)}?tag=${encodeURIComponent(t)}`}>
                {t}
              </a>
            ))}
          </div>
        </article>
        {!article.media || article.media !== "video" ? (
          <RelatedPanel articles={related} />
        ) : null}
        {videos.length > 0 && <RelatedPanel articles={videos} title={d.relatedVideos} />}
      </div>
    </>
  );
}
