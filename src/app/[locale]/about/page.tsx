import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, Locale, locales, ogLocale, withEnFallback, type NewLocale } from "@/i18n/config";
import { citeCopy } from "@/i18n/citePage";
import { faqCopy } from "@/i18n/faqQuestions";
import { absUrl, buildAlternates, SITE_URL } from "@/lib/site";
import CiteCopyButton from "@/components/CiteCopyButton";

// /[locale]/about —— 可引用资产页（linkable asset）。
// 外链优化：给媒体、研究、聚合站一个稳定、可引用、明确授权与署名规则的落地页。
// 纯静态（force-static + dynamicParams=false），与 sitemap 的收录一一对应。
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((l) => ({ locale: l }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const loc = locale as Locale;
  const c = citeCopy[loc];
  const alts = buildAlternates(loc, "/about");
  return {
    // 词典 title 已含品牌名，layout 有 title.template；absolute 避免重复拼接
    title: { absolute: c.title },
    description: c.desc,
    alternates: { canonical: alts.canonical, languages: alts.languages },
    openGraph: {
      title: c.title,
      description: c.desc,
      url: alts.canonical,
      siteName: "starteday",
      locale: ogLocale[loc],
      alternateLocale: locales.filter((l) => l !== loc).map((l) => ogLocale[l]),
      type: "website",
      images: [{ url: "/brand/og-cover.png", width: 1200, height: 630, alt: "starteday · 开启每一天" }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description: c.desc,
      images: ["/brand/og-cover.png"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const loc = locale as Locale;
  const c = citeCopy[loc];
  const s = c.sections;
  const today = new Date().toISOString().slice(0, 10);
  const canonical = absUrl(loc, "/about");

  // 可复制的规范引用示例（都指向本页，形成自引用回链）
  // 署名按语种本地化，避免在英文/日文页面里混入中文「编辑部」。
  const bylineRaw: Record<Exclude<Locale, NewLocale>, string> = {
    zh: "starteday 编辑部", en: "starteday Editorial", ja: "starteday 編集部",
    ko: "starteday 편집부", es: "Redacción starteday", fr: "Rédaction starteday",
    pt: "Redação starteday", tr: "starteday Editör",
    ru: "Редакция starteday", ar: "تحرير starteday",
    hi: "starteday संपादन", id: "Redaksi starteday",
  };
  const byline = withEnFallback(bylineRaw);
  const author = byline[loc];
  const citeStandard = `${author}. (${today}). ${c.h1}. starteday. ${canonical}`;
  const citeBib = `@misc{starteday_about_${today.replace(/-/g, "")},
  author = {{${author}}},
  title  = {${c.h1}},
  year   = {${today.slice(0, 4)}},
  note   = {${canonical}},
  url    = {${canonical}}
}`;
  const citeShort = `(starteday, ${today.slice(0, 4)})`;

  // GEO：FAQ 的「答案」全部复用本页已本地化的段落，与可见正文逐字一致，
  // 避免结构化数据与页面内容不一致（Google/AI 引擎会据此判为误导性标记）。
  const fq = faqCopy[loc];
  const faq = [
    { q: fq.questions[0], a: c.desc },
    { q: fq.questions[1], a: s.whatBody[0] },
    { q: fq.questions[2], a: s.creditBody[0] },
    { q: fq.questions[3], a: s.licenseBody },
    { q: fq.questions[4], a: s.contactBody },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: c.title,
        description: c.desc,
        inLanguage: ogLocale[loc].replace("_", "-"),
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${SITE_URL}/brand/og-cover.png`,
          width: 1200,
          height: 630,
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "starteday", item: absUrl(loc, "") },
            { "@type": "ListItem", position: 2, name: c.h1, item: canonical },
          ],
        },
      },
      {
        "@type": "NewsMediaOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: "starteday",
        areaServed: "Worldwide",
        availableLanguage: locales,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icons/icon-512.png`,
          width: 512,
          height: 512,
        },
        // 实体归属信号：让搜索引擎把外部引用归到本站实体
        sameAs: [
          `${SITE_URL}/llms.txt`,
          `${SITE_URL}/llms-full.txt`,
          `${SITE_URL}/rss.xml`,
        ],
        publishingPrinciples: canonical,
        ethicsPolicy: canonical,
        correctionsPolicy: canonical,
        actionableFeedbackPolicy: canonical,
        knowsAbout: ["technology", "business", "science", "culture", "consumer", "health"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "editorial",
          url: canonical,
          availableLanguage: locales,
        },
      },
      // GEO：把「网站是什么 / 能不能转载 / 图片怎么署名」写成可被引擎摘取的问答。
      // 答案与本页可见 FAQ 区块同源，逐字一致。
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        url: `${canonical}#faq`,
        name: fq.title,
        inLanguage: ogLocale[loc].replace("_", "-"),
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="cite-page">
        <nav className="art-crumb" aria-label="Breadcrumb">
          <Link href={`/${loc}`}>starteday</Link>
          <span aria-hidden="true"> / </span>
          <span>{c.h1}</span>
        </nav>

        <h1>{c.h1}</h1>
        <p className="cite-lead">{c.lead}</p>

        <section className="cite-sec">
          <h2 id="editorial">{s.whatTitle}</h2>
          {s.whatBody.map((p, i) => <p key={i}>{p}</p>)}
        </section>

        <section className="cite-sec" id="cite">
          <h2>{s.citeTitle}</h2>
          <p>{s.citeBody}</p>

          <div className="cite-block">
            <div className="cite-block-head">
              <span>{s.citeLabel}</span>
              <CiteCopyButton text={citeStandard} label={s.citeCopy} copied={s.citeCopied} />
            </div>
            <pre><code>{citeStandard}</code></pre>
          </div>

          <div className="cite-block">
            <div className="cite-block-head">
              <span>{s.citeBib}</span>
              <CiteCopyButton text={citeBib} label={s.citeCopy} copied={s.citeCopied} />
            </div>
            <pre><code>{citeBib}</code></pre>
          </div>

          <div className="cite-block">
            <div className="cite-block-head">
              <span>{s.citeShort}</span>
              <CiteCopyButton text={citeShort} label={s.citeCopy} copied={s.citeCopied} />
            </div>
            <pre><code>{citeShort}</code></pre>
          </div>
        </section>

        <section className="cite-sec" id="images">
          <h2>{s.creditTitle}</h2>
          {s.creditBody.map((p, i) => <p key={i}>{p}</p>)}
          <p>
            <a href="https://commons.wikimedia.org/" rel="noopener noreferrer nofollow" target="_blank">
              Wikimedia Commons ↗
            </a>
          </p>
        </section>

        <section className="cite-sec" id="license">
          <h2>{s.licenseTitle}</h2>
          <p>{s.licenseBody}</p>
        </section>

        <section className="cite-sec" id="contact">
          <h2>{s.contactTitle}</h2>
          <p>{s.contactBody}</p>
        </section>

        <section className="cite-sec" id="faq">
          <h2>{fq.title}</h2>
          <dl className="cite-faq">
            {faq.map((item, i) => (
              <div key={i}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="cite-sec" id="facts">
          <h2>{s.factsTitle}</h2>
          <dl className="cite-facts">
            {c.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="cite-sec" id="feeds" aria-label="Feeds and machine-readable entries">
          <h2>Feeds &amp; machine-readable</h2>
          <ul className="cite-links">
            <li><Link href={`/${loc}/rss.xml`}>RSS · {loc}</Link></li>
            <li><a href="/rss.xml">RSS · combined</a></li>
            <li><a href="/atom.xml">Atom</a></li>
            <li><a href="/sitemap.xml">sitemap.xml</a></li>
            <li><a href="/news-sitemap.xml">news-sitemap.xml</a></li>
            <li><a href="/llms.txt">llms.txt</a></li>
            <li><a href="/llms-full.txt">llms-full.txt</a></li>
            <li><a href="/humans.txt">humans.txt</a></li>
          </ul>
        </section>

        <p className="cite-foot">{c.footerNote}</p>
      </article>
    </div>
  );
}
