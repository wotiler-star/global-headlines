"use client";

import { useBookmarks } from "@/lib/personal";

// 收藏（书签）切换按钮。可放在卡片角标或文章页操作栏。
export default function BookmarkButton({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const { has, toggle } = useBookmarks();
  const on = has(id);
  return (
    <button
      type="button"
      className={`bm-btn${on ? " on" : ""}${className ? " " + className : ""}`}
      aria-pressed={on}
      aria-label={on ? "Unbookmark" : "Bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
