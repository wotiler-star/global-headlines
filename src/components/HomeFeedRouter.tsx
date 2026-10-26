"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Locale } from "@/i18n/config";
import { Article } from "@/data/news";
import InfiniteFeed from "./InfiniteFeed";
import SectionedFeed from "./SectionedFeed";
import RecommendedFeed from "./RecommendedFeed";
import { useAuth } from "@/lib/auth-client";
import { ViewCountsProvider } from "./ViewCounts";

// 默认首页（无筛选）展示分类板块；任何筛选（分类/搜索/标签/收藏/关注）走原无限流。
//
// mounted 门控（关键）：页面为 force-static，静态 HTML 按「无参数」构建。若首次
// 水合就依据 URL 参数切到 InfiniteFeed，会与服务端树不一致而抛 hydration #418，
// 导致子树失效（点击查看全部无反应）。因此首帧固定渲染板块树以严格匹配静态 HTML，
// 挂载完成后再按真实参数切换。
export default function HomeFeedRouter({
  locale,
  articles,
  allArticles,
}: {
  locale: Locale;
  articles: Article[];
  allArticles?: Article[];
}) {
  const sp = useSearchParams();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasFilter = !!(
    sp.get("cat") ||
    sp.get("q") ||
    sp.get("tag") ||
    sp.get("view") ||
    sp.get("src") // 地球选地区/国家 → 按分站源过滤信息流（cov15 修复断链）
  );

  // 推荐频道（无筛选）：登录用户走个性化推荐流，匿名保持分类板块浏览。
  // !mounted 首帧固定渲染板块树以匹配静态 HTML（避免 hydration #418）。
  const body = !mounted ? (
    <SectionedFeed locale={locale} articles={articles} />
  ) : hasFilter ? (
    <InfiniteFeed locale={locale} articles={articles} allArticles={allArticles} />
  ) : user ? (
    <RecommendedFeed locale={locale} articles={articles} allArticles={allArticles} />
  ) : (
    <SectionedFeed locale={locale} articles={articles} />
  );
  return (
    <ViewCountsProvider ids={articles.map((a) => a.id)}>{body}</ViewCountsProvider>
  );
}
