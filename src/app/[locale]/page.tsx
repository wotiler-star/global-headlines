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
  // cov44：首屏只下发最近 FEED_LIMIT 条。信息流本就在客户端切片（分类/搜索/标签/书签/关注），
  // 但把单语种上千条全部塞进 RSC payload 会让首屏 HTML 膨胀到 1.2MB+（gzip 后仍 300KB+）。
  // 400 条足够用户连续下滑很久，更老的内容走 /search（服务端分页，无上限）。
  const FEED_LIMIT = 400;
  const articles = (await getArticles(loc))
    .slice(0, FEED_LIMIT)
    .map((a) => ({
      ...a,
      timeAgo: formatRelativeTime(loc, a.publishedAt, d),
    }));
  const hot = await getHotBoard(loc, 10);

  // 全球地区指标汇总（全语言文章聚合，仅用于地球可视化；命中模块级缓存则零重建）
  const allArticles = await getAllArticles();
  const stats = aggregateRegions(allArticles, loc);

  // 首页信息流/热榜/全语言集均无正文消费方：strip body 后再进 RSC payload（HTML 瘦身约一半）
  // cov43：进一步裁剪——卡片只用 category/source/images/tags/summary/cover/media，
  // author 与 readMinutes 是详情页字段；summary 卡片最多两行，截断到 140 字。
  // 单语种信息流上千条，每省 200~300B 就能把首屏 RSC 载荷砍掉三分之一。
  const FEED_SUMMARY = 140;
  const feedSlim = <T extends { body: string[]; summary: string }>(list: T[]) =>
    list.map((a) => ({
      ...a,
      body: [] as string[],
      author: "",
      readMinutes: 0,
      summary: a.summary.length > FEED_SUMMARY ? a.summary.slice(0, FEED_SUMMARY) + "…" : a.summary,
    }));
  const slimArticles = feedSlim(articles);
  const slimHot = feedSlim(hot);

  // cov45：卡片图来自几十个不同 CDN，首屏建连（DNS+TCP+TLS）是真实往返开销。
  // 取首屏最常出现的几个图床 origin 提前 preconnect，能明显提前 LCP 图片到位时间。
  // 注意：卡片 <img> 没带 crossorigin，这里也不能加 crossOrigin，否则会多开一条匿名连接。
  const IMG_ORIGINS = (() => {
    // 占位图域（mock 数据用）不值得建连，过滤掉免得白开 TCP/TLS
    const SKIP = /picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com/i;
    const hits = new Map<string, number>();
    for (const a of slimArticles.slice(0, 30)) {
      for (const u of (a as { images?: string[] }).images ?? []) {
        try {
          const o = new URL(u).origin;
          if (SKIP.test(o)) continue;
          hits.set(o, (hits.get(o) || 0) + 1);
        } catch {
          /* 相对路径/非法地址忽略 */
        }
      }
    }
    return [...hits.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([o]) => o);
  })();

  return (
    <>
      {IMG_ORIGINS.map((o) => (
        <link key={o} rel="preconnect" href={o} />
      ))}
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
              {/* cov39：跨语种全量数据集(allArticles)不再下发 SSR，改由首页点地球地区(?src=)时
                  客户端按需拉 /api/all-articles，首屏 RSC 体积从 ~9MB 降到 ~3MB */}
              <HomeFeedRouterLazy locale={loc} articles={slimArticles} />
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
