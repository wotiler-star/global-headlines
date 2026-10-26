"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import NewsCard from "./NewsCard";

const PAGE = 10;

// 主信息流「推荐」频道（登录用户）：按服务端推荐算法（兴趣+时效+热度+多样性）排序的单列流。
// 冷启动（无兴趣画像）时降级为「热门推荐」流；未加载出顺序前先用最新文章占位，避免空框。
export default function RecommendedFeed({
  locale,
  articles,
}: {
  locale: Locale;
  articles: Article[];
  allArticles?: Article[];
}) {
  const d = getDict(locale);
  const [order, setOrder] = useState<string[] | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const cands = articles.slice(0, 120).map((a) => ({ id: a.id, cat: a.category, ts: a.publishedAt, tags: a.tags || [], src: a.source || "", title: a.title }));
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, candidates: cands, limit: Math.min(60, cands.length) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j || !Array.isArray(j.items)) return;
        setOrder(j.items.map((i: { id: string }) => i.id));
        setPersonalized(!!j.personalized);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [articles, locale]);

  const ordered = useMemo(() => {
    if (!order) return articles.slice(0, count);
    const byId = new Map(articles.map((a) => [a.id, a]));
    const list = order.map((id) => byId.get(id)).filter(Boolean) as Article[];
    return list.length ? list : articles;
  }, [order, articles, count]);

  const shown = ordered.slice(0, count);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setCount((c) => Math.min(c + PAGE, ordered.length));
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ordered.length]);

  return (
    <>
      <div className="section-title">
        <span className="bar" />
        {personalized ? d.recForYou : d.recHot}
      </div>
      <div className="feed">
        {shown.map((a, i) => (
          <NewsCard key={a.id} article={a} priority={i === 0} />
        ))}
      </div>
      {count < ordered.length && <div ref={sentinel} className="feed-more">{d.loadingMore}</div>}
    </>
  );
}
