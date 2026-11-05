import { Suspense, Fragment } from "react";
import { isLocale, Locale, locales, categories, ogLocale, localeMeta } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticle, getRelated, getArticles } from "@/data/newsSource";
import { formatRelativeTime } from "@/data/news";
import { absUrl, buildArticleAlternates } from "@/lib/site";
import { videoEmbedSrc } from "@/lib/video";
import { homeHref } from "@/lib/paths";
import CategoryNav from "@/components/CategoryNav";
import RelatedPanel from "@/components/RelatedPanel";
import ReadHistoryTracker from "@/components/ReadHistoryTracker";
import BookmarkButton from "@/components/BookmarkButton";
import FollowButton from "@/components/FollowButton";
import ShareBar from "@/components/ShareBar";
import ReadingProgress from "@/components/ReadingProgress";
import DecodeTitle from "@/components/DecodeTitle";
import WaveformDivider from "@/components/WaveformDivider";
import ReadingSize from "@/components/ReadingSize";
import AdSlot from "@/components/AdSlot";
import OwnerEditLink from "@/components/OwnerEditLink";
import { RichBlock } from "@/components/RichLine";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ViewTracker from "@/components/ViewTracker";
import CommentSection from "@/components/CommentSection";
import ArticleRail from "@/components/ArticleRail";
import ArticleAuthorCard from "@/components/ArticleAuthorCard";
import ArticlePrevNext from "@/components/ArticlePrevNext";

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
  const alts = buildArticleAlternates(loc, `/article/${id}`);
  const url = absUrl(loc, `/article/${id}`);
  const iso = new Date(article.publishedAt).toISOString();
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: alts.canonical, languages: alts.languages },
    openGraph: {
      title: article.title,
      description: article.summary,
      images: [{ url: article.cover || (article.images || [])[0] }],
      type: "article",
      url,
      locale: ogLocale[loc],
      alternateLocale: locales.filter((l) => l !== loc).map((l) => ogLocale[l]),
      siteName: getDict(loc).siteName,
      publishedTime: iso,
      modifiedTime: iso,
      authors: [article.author || article.source],
      section: article.category,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary,
      images: [article.cover || (article.images || [])[0]],
    },
  };
}

// 从正文抽取最具信息量的一句作为引述（确定性，无随机）
// 防御：存量 articles.json 历史上存在缺 body 的条目（卷内旧数据 / 旧版采集器 / rebuild-mirror），
// 按 undefined 容忍，避免 pickQuote 抛错把文章页打成 500。
function pickQuote(body: string[] | undefined): string {
  const src = (body?.slice(1, 3).join(" ") || body?.join(" ") || "").trim();
  const parts = src.split(/(?<=[。！？!?])/).map((x) => x.trim()).filter((x) => x.length >= 12);
  if (parts.length === 0) return "";
  parts.sort((a, b) => b.length - a.length);
  return parts[0].slice(0, 120);
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
  const quote = article.media === "video" ? "" : pickQuote(article.body);
  // 阅读时长实时估算：数据源 readMinutes 对用户稿是默认值，按正文长度重算更准
  const bodyChars = (article.body || []).join("").length;
  const cjk = loc === "zh" || loc === "ja" || loc === "ko";
  const readMin = Math.max(1, Math.round(cjk ? bodyChars / 400 : bodyChars / 1000));
  const signalId = "SIGNAL_" + article.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();

  // 配图内联：不再用独立图集区，而是把 hero 之外的配图按正文均匀分布插入段落之间
  // 位置确定性计算：第 k 张插在 body 长度的 (k+1)/(n+1) 处段落之后，避开引述位、去重
  const inlineFigs = (() => {
    if (article.media === "video") return [] as { at: number; src: string; no: number }[];
    const imgs = (article.images || []).slice(1);
    const len = article.body.length;
    if (!imgs.length || len === 0) return [];
    const quoteAt = Math.min(1, len - 1);
    const out: { at: number; src: string; no: number }[] = [];
    let prev = -1;
    imgs.forEach((src, k) => {
      let at = Math.round((len * (k + 1)) / (imgs.length + 1)) - 1;
      at = Math.min(Math.max(at, 0), len - 1);
      if (at === quoteAt && quote) at = Math.min(at + 1, len - 1); // 避免引述块后紧贴配图
      if (at <= prev) at = prev + 1;
      if (at > len - 1) return;
      prev = at;
      out.push({ at, src, no: k + 1 });
    });
    return out;
  })();
  const figMap = new Map(inlineFigs.map((f) => [f.at, f]));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "NewsArticle",
                headline: article.title,
                description: article.summary,
                inLanguage: localeMeta[loc].hreflang,
                isAccessibleForFree: true,
                image: article.images,
                datePublished: new Date(article.publishedAt).toISOString(),
                dateModified: new Date(article.publishedAt).toISOString(),
                author: { "@type": "Person", name: article.author || article.source },
                publisher: { "@type": "Organization", name: d.siteName },
                mainEntityOfPage: absUrl(loc, `/article/${id}`),
                articleSection: article.category,
                keywords: article.tags.join(", "),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: d.siteName, item: absUrl(loc, "") },
                  { "@type": "ListItem", position: 2, name: d.categories[article.category], item: absUrl(loc, `/?cat=${article.category}`) },
                  { "@type": "ListItem", position: 3, name: article.title },
                ],
              },
            ],
          }),
        }}
      />
      <ReadHistoryTracker id={article.id} category={article.category} />
      <Suspense fallback={null}>
        <CategoryNav locale={loc} active={article.category} />
      </Suspense>
      <div className="container">
        <ArticleRail locale={loc} id={id} />
        <article className="article">
          <ReadingProgress />
          <nav className="art-crumb" aria-label="breadcrumb">
            <Link href={homeHref(loc)}>HOME</Link>
            <span className="sep">/</span>
            <span>{d.categories[article.category]}</span>
            <span className="sep">/</span>
            <span className="sig">{signalId}</span>
          </nav>
          <div className="art-kicker">// {d.categories[article.category]} · SIGNAL STRONG</div>
          <DecodeTitle text={article.title} className="article-title" />
          <div className="article-byline">
            <div className="article-meta">
              <span className="src">{article.source}</span>
              <span>{formatRelativeTime(loc, article.publishedAt, d)}</span>
              <span>{readMin} min</span>
              <ViewTracker articleId={article.id} locale={loc} category={article.category} />
              <span>{d.categories[article.category]}</span>
            </div>
            <ReadingSize />
          </div>
          <div className="article-actions">
            <ArticleAuthorCard source={article.source} category={article.category} locale={loc} />
            <BookmarkButton id={article.id} category={article.category} />
            <ShareBar locale={loc} id={article.id} title={article.title} />
            <OwnerEditLink articleId={article.id} locale={loc} />
          </div>
          <div className="hero hud-frame">
            <span className="hud-c tl" />
            <span className="hud-c tr" />
            <span className="hud-c bl" />
            <span className="hud-c br" />
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
                <img src={article.cover || article.images[0]} alt={article.title} fetchPriority="high" />
              </>
            )}
          </div>
          {article.media !== "video" && (
            <div className="art-caption">SOURCE · {article.source}</div>
          )}
          <div className="art-lead">
            <div className="al-label">LEAD · 导读</div>
            <p>{article.summary}</p>
          </div>
          <AdSlot articleId={article.id} />
          <div className="article-body">
            {article.body.map((p, i) => (
              <Fragment key={i}>
                <RichBlock line={p} />
                {i === Math.min(1, article.body.length - 1) && quote && (
                  <div className="art-quote">
                    <div className="aq-label">QUOTE · 引述</div>
                    <blockquote>{quote}</blockquote>
                  </div>
                )}
                {figMap.get(i) && (
                  <figure className="art-inline-fig">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={figMap.get(i)!.src}
                      alt={article.title + " 配图 " + figMap.get(i)!.no}
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption>
                      FIG.{String(figMap.get(i)!.no).padStart(2, "0")} · {article.source}
                    </figcaption>
                  </figure>
                )}
              </Fragment>
            ))}
          </div>
          <WaveformDivider paragraphs={article.body.length} minutes={readMin} />
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
        <ArticlePrevNext locale={loc} currentId={article.id} />
        <CommentSection locale={loc} articleId={article.id} category={article.category} />
        {!article.media || article.media !== "video" ? (
          <RelatedPanel articles={related} />
        ) : null}
        {videos.length > 0 && <RelatedPanel articles={videos} title={d.relatedVideos} />}
      </div>
    </>
  );
}
