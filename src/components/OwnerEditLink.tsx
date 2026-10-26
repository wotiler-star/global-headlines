"use client";

import { useEffect, useState } from "react";

/** 文章页：若当前登录用户是该稿件作者，显示编辑入口 */
export default function OwnerEditLink({ articleId, locale }: { articleId: string; locale: string }) {
  const [mine, setMine] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/articles")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && (j.items || []).some((a: { id: string; deleted: number }) => a.id === articleId && !a.deleted)) {
          setMine(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [articleId]);

  if (!mine) return null;
  return (
    <button
      type="button"
      className="btn-sm"
      onClick={() => {
        window.location.assign(`/${locale}/write/${articleId}`);
      }}
    >
      ✍️ 编辑
    </button>
  );
}
