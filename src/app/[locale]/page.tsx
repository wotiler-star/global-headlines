import { Suspense } from "react";
import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticles } from "@/data/newsSource";
import { getHotBoard } from "@/services/feed";
import { buildAlternates } from "@/lib/site";
import InfiniteFeed from "@/components/InfiniteFeed";
import SearchChips from "@/components/SearchChips";
import HotBoard from "@/components/HotBoard";
import LeftRail from "@/components/LeftRail";
import RecommendRail from "@/components/RecommendRail";
import BreakingTicker from "@/components/BreakingTicker";
import SignalOriginMap, { SourceSignal } from "@/components/SignalOriginMap";
import { geoOf } from "@/lib/sourceGeo";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as Locale;
  const alts = buildAlternates(loc, "");
  const d = getDict(loc);
  return {
    title: d.homeTitle,
    description: d.homeDesc,
    alternates: { canonical: alts.canonical, languages: alts.languages },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) notFound();

  const d = getDict(loc);
  const articles = await getArticles(loc);
  const hot = await getHotBoard(loc, 10);

  // 信号源地理汇总（与信息流同源的构建时快照）
  const geoCount = new Map<string, SourceSignal>();
  for (const a of articles) {
    const g = geoOf(a.sourceUrl);
    if (!g) continue;
    const cur = geoCount.get(g.code);
    if (cur) cur.count += 1;
    else geoCount.set(g.code, { code: g.code, x: g.x, y: g.y, count: 1 });
  }
  const signals: SourceSignal[] = [...geoCount.values()].sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="container">
        <BreakingTicker articles={hot} />
        <Suspense fallback={null}>
          <SignalOriginMap locale={loc} sources={signals} />
        </Suspense>
        <div className="layout">
          <aside className="left-rail">
            <LeftRail locale={loc} />
          </aside>
          <Suspense fallback={null}>
            <SearchChips locale={loc} />
            <InfiniteFeed locale={loc} articles={articles} />
          </Suspense>
          <aside className="sidebar">
            <HotBoard locale={loc} items={hot} />
            <RecommendRail locale={loc} articles={articles} />
          </aside>
        </div>
      </div>
    </>
  );
}
