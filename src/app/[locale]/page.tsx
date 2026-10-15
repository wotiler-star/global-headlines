import { Suspense } from "react";
import { isLocale, Locale, locales } from "@/i18n/config";
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
import SignalDeck from "@/components/SignalDeck";
import { aggregateRegions } from "@/lib/sourceGeo";
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

  // 全球地区指标汇总（全语言文章构建时聚合，仅用于地球可视化）
  const allArticles = (await Promise.all(locales.map((l) => getArticles(l)))).flat();
  const stats = aggregateRegions(allArticles, loc);

  return (
    <>
      <div className="container">
        <BreakingTicker articles={hot} />
        <Suspense fallback={null}>
          <SignalDeck regions={stats} locale={loc} />
        </Suspense>
        <div className="layout">
          <aside className="left-rail">
            <LeftRail locale={loc} />
          </aside>
          <Suspense fallback={null}>
            <SearchChips locale={loc} />
            <InfiniteFeed locale={loc} articles={articles} allArticles={allArticles} />
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
