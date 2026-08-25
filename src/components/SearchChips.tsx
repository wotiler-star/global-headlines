"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { homeHref } from "@/lib/paths";

// 热门搜索快捷入口：仅在没有搜索词时展示，点击即跳到 ?q= 触发实时过滤。
export default function SearchChips({ locale }: { locale: Locale }) {
  const sp = useSearchParams();
  const q = (sp.get("q") || "").trim();
  if (q) return null;
  const d = getDict(locale);
  const terms = d.hotSearches;
  if (!terms.length) return null;
  return (
    <div className="search-chips">
      <span className="chips-label">{d.trendingTitle}</span>
      {terms.map((t) => (
        <Link key={t} href={`${homeHref(locale)}?q=${encodeURIComponent(t)}`} className="chip">
          {t}
        </Link>
      ))}
    </div>
  );
}
