import { locales, localeMeta, ogLocale, Locale, isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { getDict } from "@/i18n/dictionaries";
import { absUrl, SITE_URL } from "@/lib/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import BackToTop from "@/components/BackToTop";
import GeoLocaleGuard from "@/components/GeoLocaleGuard";
import PwaRegister from "@/components/PwaRegister";
import VideoModalProvider from "@/components/VideoModal";
import { AuthProvider } from "@/lib/auth-client";
import { Suspense } from "react";
import "@/app/globals.css";
import type { Metadata, Viewport } from "next";

// 浏览器地址栏 / PWA 标题栏染成品牌橙，与 manifest.theme_color 一致。
export const viewport: Viewport = {
  themeColor: "#ea5f22",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // 未知路径（/ads.txt 等）被 [locale] 段误当语种，localeMeta[loc] 为 undefined → 500。
  // 返回空 metadata + 组件体 notFound()，统一输出规范 404。
  if (!isLocale(locale)) return {};
  const loc = locale as Locale;
  const d = getDict(loc);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: d.homeTitle, template: `%s · ${d.siteName}` },
    description: d.homeDesc,
    manifest: "/manifest.webmanifest",
    // 站点所有权验证：Google 已固定；Bing / 百度 / Yandex 由环境变量注入，
    // 拿到各站长平台的验证码后只需在 docker compose 环境里加变量，无需改代码。
    verification: {
      google: "88gJuwAfrMYN7Dj6ClSV7FmUB7M67d543Nb6ejwyB9c",
      other: {
        ...(process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {}),
        ...(process.env.BAIDU_SITE_VERIFICATION ? { "baidu-site-verification": process.env.BAIDU_SITE_VERIFICATION } : {}),
        ...(process.env.YANDEX_SITE_VERIFICATION ? { "yandex-verification": process.env.YANDEX_SITE_VERIFICATION } : {}),
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    // cov65：hreflang 一律由各页面按自身真实路径声明（buildAlternates(loc, path)）。
    // layout 无法感知子路由，若在此注入 buildAlternates(loc, "")，Next 会把「指向各语种
    // 首页」的 68 个变体浅合并进页面 metadata（page 不能清除父级 languages），
    // 使 /tag/<slug> 这类无跨语种对应版本的页面带上错误 hreflang。
    // 这里只保留 canonical 兜底；page 级同名键会覆盖它。
    alternates: { canonical: absUrl(loc, "") },
    openGraph: {
      siteName: d.siteName,
      locale: ogLocale[loc],
      alternateLocale: locales.filter((l) => l !== loc).map((l) => ogLocale[l]),
      type: "website",
      images: [
        {
          url: `${SITE_URL}/brand/og-cover.png`,
          width: 1200,
          height: 630,
          alt: "starteday · 开启每一天",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [`${SITE_URL}/brand/og-cover.png`],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const loc = locale as Locale;
  const meta = localeMeta[loc];
  const d = getDict(loc);
  // suppressHydrationWarning: 内联脚本在 hydrate 前于 <html> 上写入 data-theme，
  // 服务端 HTML 无该属性，客户端有，属 React 19 已知的可容忍顶层属性差异。
  // 不加此标记会偶发触发 #418（args=[HTML,""]）。
  return (
    <html lang={meta.hreflang} dir={meta.dir} suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: absUrl(loc, ""),
                  name: d.siteName,
                  description: d.homeDesc,
                  inLanguage: meta.hreflang,
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      // cov57：真实搜索落地页是 /search?q=（SearchBox form action 指向它），
                      // 之前错写成 /?q=（首页不渲染搜索结果）→ 站点搜索框结构化数据失效。
                      urlTemplate: absUrl(loc, "/search?q={search_term_string}"),
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": "NewsMediaOrganization",
                  "@id": `${SITE_URL}/#organization`,
                  name: d.siteName,
                  // GEO / 新闻知识图谱：明确本站是新闻发布者实体，
                  // 让 Google 新闻与 AI 引擎按 NewsMediaOrganization 解析发布者权威。
                  areaServed: "Worldwide",
                  availableLanguage: locales,
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/icons/icon-512.png`,
                    width: 512,
                    height: 512,
                  },
                  // 实体归属信号（外链优化）：把机器可读入口与编辑规范页绑定到本站实体，
                  // 让搜索引擎在外部引用时能正确归并到同一个发布者。
                  sameAs: [`${SITE_URL}/llms.txt`, `${SITE_URL}/rss.xml`, `${SITE_URL}/atom.xml`],
                  publishingPrinciples: `${SITE_URL}/${loc}/about`,
                  ethicsPolicy: `${SITE_URL}/${loc}/about`,
                  correctionsPolicy: `${SITE_URL}/${loc}/about`,
                  knowsAbout: ["technology", "business", "science", "culture", "consumer", "health"],
                  contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "editorial",
                    url: `${SITE_URL}/${loc}/about`,
                    availableLanguage: ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"],
                  },
                },
              ],
            }),
          }}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${d.siteName} RSS`}
          href={`${SITE_URL}/${loc}/rss.xml`}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="starteday RSS"
          href={`${SITE_URL}/rss.xml`}
        />
        {/* Atom 是第二个标准订阅入口，供聚合器/阅读器自动发现 */}
        <link
          rel="alternate"
          type="application/atom+xml"
          title="starteday Atom"
          href={`${SITE_URL}/atom.xml`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('sd_theme')||localStorage.getItem('gh_theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();",
          }}
        />
        <Header locale={loc} />
        <GeoLocaleGuard locale={loc} />
        <AuthProvider locale={loc}>
          <VideoModalProvider locale={loc}>{children}</VideoModalProvider>
          <Footer locale={loc} />
          <Suspense fallback={null}>
            <BottomNav locale={loc} />
          </Suspense>
        </AuthProvider>
        <BackToTop />
        <PwaRegister />
      </body>
    </html>
  );
}
