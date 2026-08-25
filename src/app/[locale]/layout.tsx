import { locales, localeMeta, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { buildAlternates, SITE_URL } from "@/lib/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import BackToTop from "@/components/BackToTop";
import PwaRegister from "@/components/PwaRegister";
import VideoModalProvider from "@/components/VideoModal";
import { AuthProvider } from "@/lib/auth-client";
import { Suspense } from "react";
import "@/app/globals.css";
import type { Metadata } from "next";

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
    alternates: {
      canonical: alts.canonical,
      languages: alts.languages,
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
  return (
    <html lang={meta.hreflang} dir={meta.dir}>
      <body>
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${d.siteName} RSS`}
          href={`${SITE_URL}/${loc}/rss.xml`}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Global Headlines RSS"
          href={`${SITE_URL}/rss.xml`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('gh_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();",
          }}
        />
        <Header locale={loc} />
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
