"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Locale, Category, isCategory } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { useBookmarks, useFollows } from "@/lib/personal";
import { homeHref } from "@/lib/paths";
import { useVideoModal } from "./VideoModal";
import NewsCard from "./NewsCard";

const PAGE = 10;

// Toutiao-style endless feed: the full (already baked-in) article list is sliced
// client-side and appended as the user scrolls. Category / search / tag / bookmarks
// / following params filter the same list without a backend round-trip, so it
// stays deployable as a static export.
export default function InfiniteFeed({
  locale,
  articles,
}: {
  locale: Locale;
  articles: Article[];
}) {
  const sp = useSearchParams();
  const d = getDict(locale);
  const { ids: bookmarks } = useBookmarks();
  const { sources: follows } = useFollows();
  const vm = useVideoModal();

  // 把当前信息流喂给视频浮层，供「相关视频」横条使用（对标头条浮层内连播）。
  useEffect(() => {
    vm?.setFeed(articles);
  }, [vm, articles]);

  const catParam = sp.get("cat");
  const qParam = sp.get("q");
  const tagParam = sp.get("tag");
  const isBookmarks = sp.get("view") === "bookmarks";
  const isFollowing = sp.get("view") === "following";
  const active: Category = catParam && isCategory(catParam) ? catParam : "recommend";
  const q = qParam?.trim().toLowerCase() || "";
  const tag = tagParam?.trim().toLowerCase() || "";

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (isBookmarks && !bookmarks.has(a.id)) return false;
      if (isFollowing && !follows.has(a.source)) return false;
      if (!isBookmarks && !isFollowing && active !== "recommend" && a.category !== active) return false;
      if (tag && !a.tags.some((t) => t.toLowerCase().includes(tag)) && !a.title.toLowerCase().includes(tag))
        return false;
      if (q && !(a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [articles, isBookmarks, bookmarks, isFollowing, follows, active, tag, q]);

  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // Reset pagination whenever the active filter changes.
  useEffect(() => {
    setCount(PAGE);
  }, [active, q, tag, isBookmarks, isFollowing]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + PAGE, filtered.length));
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const shown = filtered.slice(0, count);

  return (
    <>
      {q && (
        <div className="section-title">
          <span className="bar" />
          “{qParam}” · {filtered.length} {d.relatedTitle}
        </div>
      )}
      {tag && !q && (
        <div className="section-title">
          <span className="bar" />
          {d.tagTitle}：{tagParam} · {filtered.length} {d.relatedTitle}
        </div>
      )}
      {isBookmarks && (
        <div className="section-title">
          <span className="bar" />
          {d.bookmarksTitle}
        </div>
      )}
      {isFollowing && (
        <div className="section-title">
          <span className="bar" />
          {d.followTitle}
        </div>
      )}
      {!isBookmarks && !isFollowing && !q && !tag && active !== "recommend" && (
        <div className="section-title">
          <span className="bar" />
          {d.categories[active]}
        </div>
      )}
      <div className="feed">
        {shown.length === 0 ? (
          <div className="empty">
            {isBookmarks
              ? d.bookmarksEmpty
              : isFollowing
                ? d.followEmpty
                : d.notFoundDesc}
            <div className="empty-actions">
              <Link href={homeHref(locale)} className="empty-clear">{d.clearFilters}</Link>
            </div>
          </div>
        ) : (
          shown.map((a, i) => (
            <NewsCard key={a.id} article={a} query={q || undefined} priority={i === 0} />
          ))
        )}
      </div>
      {count < filtered.length && (
        <div ref={sentinel} className="feed-more">
          {d.loadingMore}
        </div>
      )}
      {count >= filtered.length && filtered.length > 0 && (
        <div className="feed-end">{d.feedEnd}</div>
      )}
    </>
  );
}
