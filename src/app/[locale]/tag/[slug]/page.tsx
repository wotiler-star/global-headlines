import { isLocale, Locale, locales, localeMeta, ogLocale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { absUrl } from "@/lib/site";
import {
  buildTagIndex,
  indexableTags,
  loadTagSourceArticles,
  tagHref,
  type TagEntry,
} from "@/lib/tags";
import { homeHref } from "@/lib/paths";
import NewsCard from "@/components/NewsCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// cov63 内链优化：静态标签聚合页 /<locale>/tag/<slug>。
// 取代文章页原先指向 /<locale>?tag=<x> 的链接——后者 canonical 归首页、不可索引，
// 且无法把内链权重传给「同主题聚合页」。本页有独立 canonical + ItemList/BreadcrumbList，
// 并互链其他热门标签形成内链枢纽。
//
// 两处刻意设计：
// 1) tag 文本各语种不同（「人工智能」vs「AI」），跨语种不存在一一对应版本，
//    故只声明「本语种 hreflang + x-default 指向自身」，不做 68 变体互链（避免错误 hreflang）。
// 2) generateStaticParams / sitemap / 文章 chip 三处统一用 indexableTags 判定，
//    集合一致 → 零 thin content 页、构建页数可控（<= TAG_MAX_PER_LOCALE * 8）。
//    dynamicParams=true 兜底 + load() 用全量索引查询：sitemap 里的 slug 在运行期
//    数据漂移后可能跌破 TAG_MIN_ARTICLES（如 RSS 源临时减少），若 load() 也用
//    indexableTags 过滤会造成「sitemap 收录但 404」的死链。故页面渲染放宽为
//    全量 buildTagIndex 内存在即渲染（1-2 条的页面远好于 404）；仍不在全量索引
//    的 slug 才 404（从未进 sitemap，无 SEO 损害）。
export const dynamic = "force-static";
export const dynamicParams = true;

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const l of locales) {
    // 稳定数据源（见 lib/tags.ts loadTagSourceArticles）：params 与渲染必须同一份数据
    const index = buildTagIndex(loadTagSourceArticles(l));
    for (const e of indexableTags(index)) params.push({ locale: l, slug: e.slug });
  }
  return params;
}

async function load(locale: Locale, slug: string): Promise<{ entry: TagEntry; index: TagEntry[] } | null> {
  // 稳定数据源 + 全量索引兜底（含 <TAG_MIN_ARTICLES 的标签）：
  // 保证 sitemap 收录的 slug 永不 404（数据零漂移，全量索引即最终真相）
  const full = buildTagIndex(loadTagSourceArticles(locale));
  // Next 对非 ASCII slug 预渲染时可能把 URL-encoded 形式传进 params（实测 build 期如此），
  // 而索引里的 slug 是 decode 后的原文 → 必须两种形式都比对，否则中文标签页全部 404。
  let dec = slug;
  try {
    dec = decodeURIComponent(slug);
  } catch {
    /* 已是原文 */
  }
  const entry = full.find((e) => e.slug === slug || e.slug === dec);
  return entry ? { entry, index: full } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) return {};
  const found = await load(loc, slug);
  if (!found) return {};
  const d = getDict(loc);
  const tag = found.entry.tag;
  // canonical 一律用索引里的真 slug（非 encoded），与 sitemap 完全一致
  const url = absUrl(loc, `/tag/${found.entry.slug}`);
  const pageTitle = `${tag} · ${d.siteName}`;
  return {
    title: tag,
    description: `${tag} · ${d.homeDesc}`,
    alternates: {
      canonical: url,
      // 仅本语种 + x-default（标签无跨语种对应版本，刻意不做 68 变体）
      languages: { [localeMeta[loc].hreflang]: url, "x-default": url },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: pageTitle,
      description: `${tag} · ${d.homeDesc}`,
      url,
      siteName: d.siteName,
      locale: ogLocale[loc],
      type: "website",
      images: [{ url: "/brand/og-cover.png", width: 1200, height: 630, alt: d.siteName }],
    },
    twitter: { card: "summary_large_image", title: pageTitle, images: ["/brand/og-cover.png"] },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) notFound();
  const found = await load(loc, slug);
  if (!found) notFound();

  const d = getDict(loc);
  const { entry, index } = found;
  const articles = entry.articles.slice(0, 60);
  const homeUrl = absUrl(loc, "");
  const tagUrl = absUrl(loc, `/tag/${entry.slug}`);
  // 内链枢纽：互链其他优质标签（排除自身），把权重在标签层扩散
  const siblingTags = index.filter((e) => e.slug !== entry.slug).slice(0, 16);

  return (
    <div className="container">
      <div className="cat-page-head">
        <h1 className="cat-page-title"># {entry.tag}</h1>
        <p className="cat-page-sub">{d.homeDesc}</p>
      </div>

      <nav className="cat-crumb" aria-label="breadcrumb">
        <Link href={homeHref(loc)}>{d.siteName}</Link>
        <span className="sep">/</span>
        <span className="cur">{entry.tag}</span>
      </nav>

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: d.siteName, item: homeUrl },
              { "@type": "ListItem", position: 2, name: entry.tag, item: tagUrl },
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

      {siblingTags.length > 0 && (
        <nav className="tag-hub" aria-label={d.tagTitle}>
          <div className="th-label">RELATED TAGS · {d.tagTitle}</div>
          <div className="th-links">
            {siblingTags.map((e) => (
              <Link key={e.slug} href={tagHref(loc, e.slug)} className="th-link">
                # {e.tag}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
