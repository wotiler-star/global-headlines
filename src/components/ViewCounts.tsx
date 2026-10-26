"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ViewCountsCtx = createContext<Record<string, number>>({});

// Provider：拿到当前列表的全部文章 id，挂载后一次性批量取阅读量。
// SSR/首帧 counts 为空（与服务端渲染一致），取回后再回填，不会产生水合不一致。
export function ViewCountsProvider({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = useMemo(
    () => Array.from(new Set(ids.filter(Boolean))).slice(0, 200).join(","),
    [ids]
  );
  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/views/bulk?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && j.counts) setCounts(j.counts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return <ViewCountsCtx.Provider value={counts}>{children}</ViewCountsCtx.Provider>;
}

// 徽标：仅在有阅读量时显示（无数据不占位，保持列表整洁）
export function ViewCountBadge({ articleId }: { articleId: string }) {
  const counts = useContext(ViewCountsCtx);
  const n = counts ? counts[articleId] : 0;
  if (!n) return null;
  return <span className="views-badge">🔥 {n}</span>;
}
