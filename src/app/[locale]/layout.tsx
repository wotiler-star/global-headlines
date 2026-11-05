import { locales, localeMeta, ogLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { buildAlternates, absUrl, SITE_URL } from "@/lib/site";
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
  const loc = locale as Locale;
  const d = getDict(loc);
  const alts = buildAlternates(loc, "");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: d.homeTitle, template: `%s · ${d.siteName}` },
    description: d.homeDesc,
    manifest: "/manifest.webmanifest",
    // Google Search Console 站点所有权验证（HTML 标记方式）。
    // Next.js 会输出 <meta name="google-site-verification" content="...">，覆盖全部语种页面。
    verification: {
      google: "88gJuwAfrMYN7Dj6ClSV7FmUB7M67d543Nb6ejwyB9c",
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    alternates: {
      canonical: alts.canonical,
      languages: alts.languages,
    },
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
                      urlTemplate: absUrl(loc, "/?q={search_term_string}"),
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: d.siteName,
                  url: absUrl(loc, ""),
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/icon.svg`,
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
