"use client";

import { useFollows } from "@/lib/personal";
import { getDict } from "@/i18n/dictionaries";
import { Locale } from "@/i18n/config";

// 关注（来源）切换按钮。可放在卡片来源旁或文章页操作栏。
export default function FollowButton({
  source,
  locale,
  className,
}: {
  source: string;
  locale: Locale;
  className?: string;
}) {
  const { has, toggle } = useFollows();
  const d = getDict(locale);
  const on = has(source);
  return (
    <button
      type="button"
      className={`follow-btn${on ? " on" : ""}${className ? " " + className : ""}`}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(source);
      }}
    >
      {on ? `✓ ${d.followingLabel}` : `+ ${d.followLabel}`}
    </button>
  );
}
