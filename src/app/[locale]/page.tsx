import { Suspense } from "react";
import { isLocale, Locale, locales } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticles } from "@/data/newsSource";
import { formatRelativeTime, type Article } from "@/data/news";
import { getHotBoard } from "@/services/feed";
import { buildAlternates } from "@/lib/site";
import SearchChips from "@/components/SearchChips";
import HeroHead from "@/components/HeroHead";
import TodayBrief from "@/components/TodayBrief";
import HotBoard from "@/components/HotBoard";
import LeftRail from "@/components/LeftRail";
import RecommendRail from "@/components/RecommendRail";
import HomeFeedRouterLazy from "@/components/HomeFeedRouterLazy";
import EditorPicks from "@/components/EditorPicks";
import DiscussBoard from "@/components/DiscussBoard";
import BreakingTicker from "@/components/BreakingTicker";
import SignalDeckLazy from "@/components/SignalDeckLazy";
import { aggregateRegions } from "@/lib/sourceGeo";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// 全语言文章聚合结果模块级缓存（首页地球仪可视化用，与 UI 语言无关）。
// cov29 性能：全语言拉取 + aggregateRegions 是首页最贵操作；跨请求/跨语言复用，
// 15min 陈旧对可视化完全可接受（地球信号本身按发布时间聚合，分钟级延迟无感）。
const ALL_ARTICLES_TTL = 15 * 60_000;
let allArticlesCache: { ts: number; items: Article[] } | null = null;
async function getAllArticles(): Promise<Article[]> {
  if (allArticlesCache && Date.now() - allArticlesCache.ts < ALL_ARTICLES_TTL) {
    return allArticlesCache.items;
  }
  const items = (await Promise.all(locales.map((l) => getArticles(l)))).flat();
  allArticlesCache = { ts: Date.now(), items };
  return items;
}

// 动态渲染（cov16 根因修复）：首页大量 Client 组件通过 useSearchParams 读取 URL 参数
// （?src / ?cat / ?q / ?view / ?tag 等）。若设为 force-static，构建期会以「空参数」预渲染
// 这些组件，而客户端按真实参数首渲，二者树不一致 → React #418（子树失效、点击查看全部/分站无反应）。
// 改为 force-dynamic 让服务端按真实请求参数渲染，SSR HTML 与客户端首帧严格一致，从根上消除 #418。
// 数据层本身有模块级缓存（按 TTL），逐请求渲染开销可控；发布即时进信息流不再依赖 revalidatePath。
export const dynamic = "force-dynamic";

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
  // timeAgo 在服务端（构建期）算好并随 RSC 载荷下发：SSR HTML 与客户端首渲一致，
  // 挂载后 NewsCard 再用实时时间重算，避免 force-static 页面跨时间后 hydration mismatch。
  const articles = (await getArticles(loc)).map((a) => ({
    ...a,
    timeAgo: formatRelativeTime(loc, a.publishedAt, d),
  }));
  const hot = await getHotBoard(loc, 10);

  // 全球地区指标汇总（全语言文章聚合，仅用于地球可视化；命中模块级缓存则零重建）
  const allArticles = await getAllArticles();
  const stats = aggregateRegions(allArticles, loc);

  // 首页信息流/热榜/全语言集均无正文消费方：strip body 后再进 RSC payload（HTML 瘦身约一半）
  const slim = <T extends { body: string[] }>(list: T[]) => list.map((a) => ({ ...a, body: [] as string[] }));
  const slimArticles = slim(articles);
  const slimHot = slim(hot);
  const slimAll = slim(allArticles);

  return (
    <>
      <div className="container">
        <BreakingTicker articles={slimHot} />
        <HeroHead locale={loc} />
        <Suspense fallback={null}>
          <SignalDeckLazy regions={stats} locale={loc} />
        </Suspense>
        <div className="layout">
          <aside className="left-rail">
            <LeftRail locale={loc} />
          </aside>
          <Suspense fallback={null}>
            <div className="main-col">
              <TodayBrief locale={loc} items={slimHot} />
              <SearchChips locale={loc} />
              <HomeFeedRouterLazy locale={loc} articles={slimArticles} allArticles={slimAll} />
            </div>
          </Suspense>
          <aside className="sidebar">
            <HotBoard locale={loc} items={slimHot} />
            <EditorPicks locale={loc} />
            <DiscussBoard locale={loc} items={slimHot} />
            <RecommendRail locale={loc} articles={slimArticles} />
          </aside>
        </div>
      </div>
    </>
  );
}
