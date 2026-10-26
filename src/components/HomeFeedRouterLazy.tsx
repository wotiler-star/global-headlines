"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/i18n/config";
import type { Article } from "@/data/news";

// 首屏 JS 瘦身（cov31）
// HomeFeedRouter 是首页核心信息流 client 组件，其子树（InfiniteFeed / SectionedFeed
// / RecommendedFeed / ViewCounts / useAuth）体积较大。用 next/dynamic 把它拆成独立
// chunk：默认 ssr:true —— 服务端仍输出信息流 HTML（不损 SEO/LCP），但首屏主 bundle
// 不再内联该子树 JS，浏览器可并行、延迟拉取执行。
// 注：HomeFeedRouter 内含 useSearchParams，但 page.tsx 已用 <Suspense> 包裹，不会
// 触发整页 CSR bailout（cov30 已确认）。
const HomeFeedRouter = dynamic(() => import("./HomeFeedRouter"), {
  loading: () => <div style={{ minHeight: 600 }} aria-hidden />,
});

export default function HomeFeedRouterLazy({
  locale,
  articles,
  allArticles,
}: {
  locale: Locale;
  articles: Article[];
  allArticles?: Article[];
}) {
  return (
    <HomeFeedRouter locale={locale} articles={articles} allArticles={allArticles} />
  );
}
