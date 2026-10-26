"use client";

import { useEffect, useState } from "react";

// 阅读量埋点：进入文章页上报一次，同访客同文章只计一次（服务端唯一索引去重），
// 同一会话内重复渲染不再重复请求。展示累计阅读量（SSR 为 0，挂载后回填，不会水合不一致）。
export default function ViewTracker({
  articleId,
  locale,
  category,
}: {
  articleId: string;
  locale: string;
  category?: string;
}) {
  const [views, setViews] = useState(0);

  useEffect(() => {
    const key = "gh_view_sent:" + articleId;
    let sent = false;
    try {
      sent = sessionStorage.getItem(key) === "1";
    } catch {
      /* sessionStorage 不可用则每次上报（服务端仍会去重） */
    }
    const done = (n: number) => setViews(typeof n === "number" ? n : 0);
    if (sent) {
      fetch(`/api/views?articleId=${encodeURIComponent(articleId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && done(j.views))
        .catch(() => {});
      return;
    }
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, locale, category }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && done(j.views))
      .catch(() => {});
  }, [articleId, locale, category]);

  return <span className="views-badge">{views > 0 ? `🔥 ${views}` : ""}</span>;
}
