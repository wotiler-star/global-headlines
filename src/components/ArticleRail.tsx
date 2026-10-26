"use client";

import { useEffect, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { useBookmarks, useLikes } from "@/lib/personal";

// 今日头条式左侧悬浮操作栏：点赞 / 评论 / 收藏 / 分享。
// 点赞与收藏走 localStorage（收藏登录后同步服务端），评论数为实时拉取。
export default function ArticleRail({ locale, id }: { locale: Locale; id: string }) {
  const d = getDict(locale);
  const { has: liked, toggle: toggleLike } = useLikes();
  const { has: saved, toggle: toggleSave } = useBookmarks();
  const [cmtCount, setCmtCount] = useState(0);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/comments?articleId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j) => { if (alive) setCmtCount(Array.isArray(j.comments) ? j.comments.length : 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setFlash(d.copiedLabel);
        window.setTimeout(() => setFlash(""), 2000);
      }
    } catch {
      /* 用户取消分享 */
    }
  };

  return (
    <div className="art-rail" role="toolbar" aria-label="article actions">
      <button
        type="button"
        className={`ar-btn${liked(id) ? " on" : ""}`}
        aria-pressed={liked(id)}
        aria-label={liked(id) ? d.likedLabel : d.likeLabel}
        title={liked(id) ? d.likedLabel : d.likeLabel}
        onClick={() => toggleLike(id)}
      >
        <span className="ar-ico" aria-hidden>👍</span>
      </button>
      <button
        type="button"
        className="ar-btn"
        aria-label={d.commentLabel}
        title={d.commentLabel}
        onClick={() => document.querySelector(".comments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        <span className="ar-ico" aria-hidden>💬</span>
        {cmtCount > 0 && <span className="ar-n">{cmtCount}</span>}
      </button>
      <button
        type="button"
        className={`ar-btn${saved(id) ? " on" : ""}`}
        aria-pressed={saved(id)}
        aria-label={saved(id) ? d.savedLabel : d.saveLabel}
        title={saved(id) ? d.savedLabel : d.saveLabel}
        onClick={() => toggleSave(id, undefined)}
      >
        <span className="ar-ico" aria-hidden>{saved(id) ? "★" : "☆"}</span>
      </button>
      <button type="button" className="ar-btn" aria-label={d.shareLabel} title={d.shareLabel} onClick={share}>
        <span className="ar-ico" aria-hidden>↗</span>
      </button>
      {flash && <span className="ar-flash">{flash}</span>}
    </div>
  );
}
