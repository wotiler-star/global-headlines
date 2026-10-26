"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Locale, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import NewsCard from "@/components/NewsCard";

const PAGE = 24;

// 头条搜索式结果区：分类 tab（综合 + 各分类）+ 排序（相关度/最新）+ 加载更多。
export default function SearchResults({
  locale,
  q,
  cat,
  sort,
  initial,
}: {
  locale: Locale;
  q: string;
  cat: string;
  sort: string;
  initial: any[];
}) {
  const d = getDict(locale);
  const router = useRouter();
  const [list, setList] = useState<any[]>(initial);
  const [offset, setOffset] = useState(initial.length);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < PAGE);

  const go = (nextCat: string, nextSort: string) => {
    const sp = new URLSearchParams({ q });
    if (nextCat && nextCat !== "all") sp.set("cat", nextCat);
    if (nextSort && nextSort !== "rel") sp.set("sort", nextSort);
    router.push(`/${locale}/search?${sp.toString()}`);
  };

  const loadMore = async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const extra = [
        cat && cat !== "all" ? `&category=${cat}` : "",
        sort === "new" ? "&sort=new" : "",
      ].join("");
      const r = await fetch(
        `/api/articles?locale=${locale}&q=${encodeURIComponent(q)}&limit=${PAGE}&offset=${offset}${extra}`
      );
      const j = await r.json();
      const more = j.articles || [];
      setList((prev) => [...prev, ...more]);
      setOffset((o) => o + more.length);
      if (more.length < PAGE) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [{ key: "all", label: d.searchAllTab }].concat(
    categories.filter((c) => c !== "recommend").map((c) => ({ key: c, label: d.categories[c] }))
  );

  // tab 方向键导航（WAI-ARIA tabs 模式）：←/→/Home/End 移动焦点并自动切换分类；
  // roving tabindex（仅选中 tab 可 Tab 聚焦），结果区为 tabpanel。
  //
  // 焦点回补：搜索页是 force-dynamic，router.push 换 searchParams 时整个页面段
  // （含 tab 行）会被重挂载，旧 DOM 节点被替换、焦点落回 body。因此键盘切换前把
  // 目标 tab key 写入 sessionStorage，导航后（重挂载或 cat 变化）按需回焦；
  // 鼠标点击不写标记，避免抢焦点。
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const k = sessionStorage.getItem("sp-tab-focus");
    if (!k) return;
    sessionStorage.removeItem("sp-tab-focus");
    const idx = tabs.findIndex((t) => t.key === k);
    tabRefs.current[idx]?.focus();
  }, [cat]);
  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = tabs[next].key;
    tabRefs.current[next]?.focus(); // 即时反馈（DOM 未被替换时直接生效）
    if (target === cat) return; // 原地移动焦点，不导航
    sessionStorage.setItem("sp-tab-focus", target);
    go(target, sort);
  };

  return (
    <>
      <div className="sp-tabs">
        <div className="sp-tablist" role="tablist" aria-label={d.searchResults}>
          {tabs.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`sp-tab-${t.key}`}
              aria-selected={cat === t.key}
              aria-controls="sp-panel"
              tabIndex={cat === t.key ? 0 : -1}
              className={`sp-tab${cat === t.key ? " active" : ""}`}
              onClick={() => go(t.key, sort)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="sp-sort">
          <button
            type="button"
            className={`sp-sort-btn${sort !== "new" ? " active" : ""}`}
            onClick={() => go(cat, "rel")}
          >
            {d.searchSortRel}
          </button>
          <button
            type="button"
            className={`sp-sort-btn${sort === "new" ? " active" : ""}`}
            onClick={() => go(cat, "new")}
          >
            {d.searchSortNew}
          </button>
        </span>
      </div>
      <div className="search-results" role="tabpanel" id="sp-panel" aria-labelledby={`sp-tab-${cat}`}>
        {list.length === 0 ? (
          <div className="search-noresult">{d.searchNoResult.replace("{q}", q)}</div>
        ) : (
          list.map((a, i) => (
            <NewsCard key={a.id} article={a as any} query={q} priority={i === 0} />
          ))
        )}
      </div>
      {!done && (
        <div className="search-more">
          <button className="load-more-btn" onClick={loadMore} disabled={loading}>
            {loading ? "…" : d.searchLoadMore}
          </button>
        </div>
      )}
      {done && list.length >= PAGE && <div className="search-nomore">{d.searchNoMore}</div>}
    </>
  );
}
