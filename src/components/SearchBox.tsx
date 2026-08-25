"use client";

import { useSearchParams } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { homeHref } from "@/lib/paths";

// 搜索框：提交走 GET 导航到首页带 ?q=，由 InfiniteFeed 实时过滤。
// 回填当前 q，避免搜索后输入框被清空（此前是 server 渲染、无默认值）。
export default function SearchBox({ locale }: { locale: Locale }) {
  const sp = useSearchParams();
  const d = getDict(locale);
  const q = sp.get("q") || "";
  return (
    <form className="search-form" action={homeHref(locale)} method="get" role="search">
      <input
        className="search-input"
        type="search"
        name="q"
        defaultValue={q}
        placeholder={d.searchPlaceholder}
        aria-label={d.searchPlaceholder}
      />
      <button className="search-btn" type="submit">🔍</button>
    </form>
  );
}
