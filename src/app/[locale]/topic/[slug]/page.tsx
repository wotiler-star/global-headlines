import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, Locale, locales, localeMeta, ogLocale } from "@/i18n/config";
import { absUrl, buildAlternates, SITE_URL } from "@/lib/site";
import { findTopic, loadTopics, topicHref } from "@/lib/topics";
import { homeHref } from "@/lib/paths";

// /[locale]/topic/<slug> —— GEO 主题实体档案页。
// 一个 slug 对应同一篇原创报道的 8 个语种版本：稳定拉丁 URL、真正对称的 hreflang、
// 可被引擎直接引用的「实体 + 多语种标题」清单。与 /tag/<slug> 互补（后者按标签词聚合）。
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const l of locales) {
    for (const t of loadTopics()) params.push({ locale: l, slug: t.slug });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const loc = locale as Locale;
  const t = findTopic(slug);
  if (!t) return {};
  const a = t.articles[loc] || t.articles.zh;
  const title = a ? `${a.title} · 8 语种主题档案` : `${t.slug} · 主题档案`;
  const desc = a?.summary || `${t.slug}：starteday 的 8 语种原创报道档案。`;
  const alts = buildAlternates(loc, topicHref(loc, t.slug).replace(`/${loc}`, ""));
  return {
    title,
    description: desc,
    alternates: { canonical: alts.canonical, languages: alts.languages },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: desc,
      url: alts.canonical,
      siteName: "starteday",
      locale: ogLocale[loc],
      type: "website",
      images: [{ url: "/brand/og-cover.png", width: 1200, height: 630, alt: "starteday" }],
    },
    twitter: { card: "summary_large_image", title, images: ["/brand/og-cover.png"] },
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const loc = locale as Locale;
  const t = findTopic(slug);
  if (!t) notFound();

  const canonical = absUrl(loc, `/topic/${t.slug}`);
  const versions = locales
    .map((l) => ({ l, a: t.articles[l] }))
    .filter((x) => !!x.a) as { l: Locale; a: NonNullable<(typeof t.articles)[Locale]> }[];
  const main = t.articles[loc] || t.articles.zh || versions[0]?.a;
  const day = t.publishedAt ? new Date(t.publishedAt).toISOString().slice(0, 10) : "—";
  const desc = `${t.slug}：starteday 关于该主题的 ${versions.length} 个语种原创报道，发布于 ${day}，栏目 ${t.category}。`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: `${t.slug} · starteday 主题档案`,
        description: desc,
        inLanguage: localeMeta[loc].hreflang,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${canonical}#entity` },
        hasPart: { "@id": `${canonical}#itemlist` },
      },
      {
        "@type": "Thing",
        "@id": `${canonical}#entity`,
        name: t.slug,
        description: desc,
        url: canonical,
        alternateName: versions.map((v) => v.a.title),
        subjectOf: versions.map((v) => ({
          "@type": "CreativeWork",
          url: absUrl(v.l, `/article/${v.a.id}`),
          name: v.a.title,
          inLanguage: localeMeta[v.l].hreflang,
        })),
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#itemlist`,
        numberOfItems: versions.length,
        itemListElement: versions.map((v, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(v.l, `/article/${v.a.id}`),
          name: `[${v.l}] ${v.a.title}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "starteday", item: absUrl(loc, "") },
          { "@type": "ListItem", position: 2, name: t.slug, item: canonical },
        ],
      },
    ],
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="topic-page">
        <nav className="art-crumb" aria-label="Breadcrumb">
          <Link href={homeHref(loc)}>starteday</Link>
          <span aria-hidden="true"> / </span>
          <span>{t.slug}</span>
        </nav>

        <div className="tp-label">TOPIC DOSSIER · 主题实体档案</div>
        <h1>{main ? main.title : t.slug}</h1>
        <p className="tp-desc">{desc}</p>

        <section className="entity-card" aria-label="Topic facts">
          <div className="ec-label">ENTITY FACTS</div>
          <dl className="cite-facts">
            <div><dt>Entity slug</dt><dd>{t.slug}</dd></div>
            <div><dt>Language versions</dt><dd>{versions.length}</dd></div>
            <div><dt>Published</dt><dd>{day}</dd></div>
            <div><dt>Section</dt><dd>{t.category}</dd></div>
          </dl>
          <p className="ec-note">
            本页列出同一主题在各语种的独立原创稿；引用格式、图片许可与纠错渠道见{" "}
            <Link href={`/${loc}/about`}>关于与引用 ↗</Link>。
            {t.sourceUrl ? (
              <> 原始报道：<a href={t.sourceUrl} rel="nofollow noopener noreferrer citation" target="_blank">{t.sourceUrl} ↗</a></>
            ) : null}
          </p>
        </section>

        <section className="tp-versions" aria-label="Language versions">
          <h2>8 语种版本 · Language versions</h2>
          <ol className="tp-list">
            {versions.map((v) => (
              <li key={v.l}>
                <span className="tp-loc">{v.l}</span>
                <Link href={`/${v.l}/article/${v.a.id}`}>{v.a.title}</Link>
              </li>
            ))}
          </ol>
        </section>

        <p className="cite-foot">本页是可引用的永久入口，链接稳定，可直接指向。</p>
      </article>
    </div>
  );
}
