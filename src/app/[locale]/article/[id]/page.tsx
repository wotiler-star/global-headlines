import { Suspense, Fragment } from "react";
import { isLocale, Locale, locales, categories, ogLocale, localeMeta } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticle, getRelated, getArticles } from "@/data/newsSource";
import { formatRelativeTime } from "@/data/news";
import { absUrl, buildArticleAlternates, SITE_URL, articleBaseId, articleVersionId } from "@/lib/site";
import { ogImageFor } from "@/lib/og";
import { IMAGE_CREDITS } from "@/lib/imageCredits";
import { videoEmbedSrc } from "@/lib/video";
import { homeHref, articleHref, categoryHref } from "@/lib/paths";
import { buildTagIndex, loadTagSourceArticles, tagHrefIfIndexed } from "@/lib/tags";
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
import MoreInCategory from "@/components/MoreInCategory";

// CC 许可文本 → 规范许可 URL（Google 图片搜索的 license 字段要求 URL）
function licenseUrl(lic: string): string | undefined {
  const sa = /CC BY-SA ([\d.]+)/i.exec(lic);
  if (sa) return `https://creativecommons.org/licenses/by-sa/${sa[1]}/`;
  const by = /CC BY ([\d.]+)/i.exec(lic);
  if (by) return `https://creativecommons.org/licenses/by/${by[1]}/`;
  if (/CC0/i.test(lic)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (/public domain/i.test(lic)) return "https://creativecommons.org/publicdomain/mark/1.0/";
  return undefined;
}

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
  const alts = buildArticleAlternates(loc, id);
  const url = absUrl(loc, `/article/${id}`);
  const iso = new Date(article.publishedAt).toISOString();
  const og = ogImageFor(article.cover || (article.images || [])[0], article.title);
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: alts.canonical, languages: alts.languages },
    // 允许大图预览与完整摘要，提升搜索结果/社交卡片展示
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    openGraph: {
      title: article.title,
      description: article.summary,
      images: [og],
      type: "article",
      url,
      locale: ogLocale[loc],
      alternateLocale: locales.filter((l) => l !== loc).map((l) => ogLocale[l]),
      siteName: getDict(loc).siteName,
      publishedTime: iso,
      modifiedTime: iso,
      authors: [article.author || article.source],
      section: article.category,
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary,
      images: [og.url],
    },
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
  const og = ogImageFor(article.cover || (article.images || [])[0], article.title);
  const related = await getRelated(loc, article);
  // cov63 内链优化：文章页需要 (a) 标签静态页 slug 索引 (b) 同栏目文章列表。
  // tagIndex 必须与标签页 generateStaticParams / sitemap 用同一份**稳定**数据源
  // （loadTagSourceArticles 只读 data/original/*.json，不联网）——getArticles 的 RSS
  // 部分按 worker 漂移，曾导致 chip 指向的静态页实际 prerender 为 404。
  const allInLocale = await getArticles(loc);
  const tagIndex = buildTagIndex(loadTagSourceArticles(loc));
  const sameCategory = allInLocale
    .filter((a) => a.id !== article.id && a.category === article.category && a.media !== "video")
    .slice(0, 8);
  const videos = article.media === "video"
    ? (await getArticles(loc, "video")).filter((a) => a.id !== article.id).slice(0, 6)
    : [];
  // 阅读时长实时估算：数据源 readMinutes 对用户稿是默认值，按正文长度重算更准
  const bodyChars = (article.body || []).join("").length;
  const cjk = loc === "zh" || loc === "ja" || loc === "ko";
  const readMin = Math.max(1, Math.round(cjk ? bodyChars / 400 : bodyChars / 1000));
  // 原创稿每个主题都有 8 份独立撰写的本地化版本；head 里已声明完整 hreflang 互链，
  // 这里再给出可见内链，帮助爬虫发现与用户主动切换（hreflang 之外的第二重信号）。
  const isMultilingual = article.id.startsWith("rss-orig-");
  const baseId = isMultilingual ? articleBaseId(article.id) : article.id;

  // 配图内联：不再用独立图集区，而是把 hero 之外的配图按正文均匀分布插入段落之间
  // 位置确定性计算：第 k 张插在 body 长度的 (k+1)/(n+1) 处段落之后，去重
  const inlineFigs = (() => {
    if (article.media === "video") return [] as { at: number; src: string; no: number }[];
    const imgs = (article.images || []).slice(1);
    const len = article.body.length;
    if (!imgs.length || len === 0) return [];
    const out: { at: number; src: string; no: number }[] = [];
    let prev = -1;
    imgs.forEach((src, k) => {
      let at = Math.round((len * (k + 1)) / (imgs.length + 1)) - 1;
      at = Math.min(Math.max(at, 0), len - 1);
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
                "@id": absUrl(loc, `/article/${id}#article`),
                headline: article.title,
                description: article.summary,
                url: absUrl(loc, `/article/${id}`),
                inLanguage: localeMeta[loc].hreflang,
                isAccessibleForFree: true,
                wordCount: bodyChars,
                // 首项为 1.91:1 社交分享图，Google 新闻/图片结果可选多比例
                image: [og.url, ...(article.images || []).map((p: string) =>
                  p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`
                )],
                datePublished: new Date(article.publishedAt).toISOString(),
                dateModified: new Date(article.publishedAt).toISOString(),
                author: { "@type": "Person", name: article.author || article.source },
                publisher: {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: d.siteName,
                  url: absUrl(loc, ""),
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
                },
                mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(loc, `/article/${id}`) },
                isPartOf: { "@id": `${SITE_URL}/#website` },
                articleSection: article.category,
                keywords: article.tags.join(", "),
                hasPart: (article.images || []).map((_: string, i: number) => ({
                  "@id": `${absUrl(loc, `/article/${id}`)}#image${i + 1}`,
                })),
              },
              // 图片的 CC 许可与作者身份：Google 图片搜索据此展示「可授权」信息与署名
              ...(article.images || []).map((p: string, i: number) => {
                const credit = IMAGE_CREDITS[p];
                const url = p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
                const node: Record<string, unknown> = {
                  "@type": "ImageObject",
                  "@id": `${absUrl(loc, `/article/${id}`)}#image${i + 1}`,
                  url,
                  contentUrl: url,
                  caption: `${article.title} · 配图 ${i + 1}`,
                };
                if (credit) {
                  node.creator = { "@type": "Person", name: credit.artist };
                  node.creditText = credit.artist;
                  node.copyrightHolder = { "@type": "Person", name: credit.artist };
                  node.acquireLicensePage = credit.url;
                  const lu = licenseUrl(credit.license);
                  if (lu) node.license = lu;
                }
                return node;
              }),
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: d.siteName, item: absUrl(loc, "") },
                  { "@type": "ListItem", position: 2, name: d.categories[article.category], item: absUrl(loc, `/category/${article.category}`) },
                  { "@type": "ListItem", position: 3, name: article.title, item: absUrl(loc, `/article/${id}`) },
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
            <Link href={homeHref(loc)}>{d.siteName}</Link>
            <span className="sep">/</span>
            <Link href={categoryHref(loc, article.category)}>{d.categories[article.category]}</Link>
            <span className="sep">/</span>
            <span className="sig" title={article.title}>
              {article.title.length > 42 ? `${article.title.slice(0, 42)}…` : article.title}
            </span>
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
                <img src={article.cover || article.images[0]} alt={article.title} width={1200} height={800} fetchPriority="high" />
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
                {figMap.get(i) && (
                  <figure className="art-inline-fig">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={figMap.get(i)!.src}
                      alt={article.title + " 配图 " + figMap.get(i)!.no}
                      width={1200}
                      height={800}
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption>
                      FIG.{String(figMap.get(i)!.no).padStart(2, "0")} · {IMAGE_CREDITS[figMap.get(i)!.src]?.artist || article.source}
                      {IMAGE_CREDITS[figMap.get(i)!.src]?.license
                        ? ` · ${IMAGE_CREDITS[figMap.get(i)!.src]!.license}`
                        : ""}
                    </figcaption>
                  </figure>
                )}
              </Fragment>
            ))}
          </div>
          <WaveformDivider paragraphs={article.body.length} minutes={readMin} />
          {(article.images || []).some((p) => IMAGE_CREDITS[p]) && (
            <section className="art-image-credits" aria-label="图片来源">
              <div className="aic-label">IMAGE CREDITS · 图片来源</div>
              <ul>
                {(article.images || []).filter((p) => IMAGE_CREDITS[p]).map((p) => (
                  <li key={p}>
                    <a href={IMAGE_CREDITS[p].url} target="_blank" rel="noopener noreferrer">
                      {p.split("/").pop()}
                    </a>
                    {" · "}{IMAGE_CREDITS[p].artist}{" · "}{IMAGE_CREDITS[p].license}{" · Wikimedia Commons"}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="article-tags">
            <span className="tag-label">{d.tagTitle}：</span>
            {article.tags.map((t, i) => {
              // cov63：命中标签索引 → 静态聚合页（可索引、传递权重）；
              // 未命中（低频标签，避免 thin content）→ 保留 ?tag= 首页筛选，零死链、不破坏功能。
              const href = tagHrefIfIndexed(loc, t, tagIndex)
                ?? `${homeHref(loc)}?tag=${encodeURIComponent(t)}`;
              return (
                <Link key={i} className="tag-chip" href={href}>
                  {t}
                </Link>
              );
            })}
          </div>
          {/* cov63：8 语种可见内链扩到「全部文章」。
              原创稿(rss-orig-*)有 8 份独立本地化版本 → 链接对应语种文章页；
              其余稿的 id 按语种生成、跨语种文章链接会 404 → 改链对应语种的
              同栏目静态页（全部预渲染、可索引、带 hreflang），既扩内链又零死链。 */}
          <nav className="art-lang-versions" aria-label={d.navLanguage}>
            <div className="alv-label">
              {isMultilingual ? "READ IN" : "BROWSE"} · {d.navLanguage}
            </div>
            <div className="alv-links">
              {locales.map((l) => (
                <Link
                  key={l}
                  href={isMultilingual
                    ? articleHref(l, articleVersionId(baseId, l))
                    : categoryHref(l, article.category)}
                  hrefLang={localeMeta[l].hreflang}
                  aria-current={l === loc ? "page" : undefined}
                  className={`alv-link${l === loc ? " current" : ""}`}
                >
                  {localeMeta[l].name}
                </Link>
              ))}
            </div>
          </nav>
        </article>
        <ArticlePrevNext locale={loc} currentId={article.id} category={article.category} />
        {/* cov63：同栏目确定性内链（文章 → 同栏目文章 / 栏目页），与 RelatedPanel 的
            语义相关推荐互补，缩短抓取深度并强化主题聚类。 */}
        <MoreInCategory locale={loc} category={article.category} articles={sameCategory} />
        <CommentSection locale={loc} articleId={article.id} category={article.category} />
        {!article.media || article.media !== "video" ? (
          <RelatedPanel articles={related} />
        ) : null}
        {videos.length > 0 && <RelatedPanel articles={videos} title={d.relatedVideos} />}
      </div>
    </>
  );
}
