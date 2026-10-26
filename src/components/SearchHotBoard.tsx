"use client";

import { useState } from "react";
import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { articleHref } from "@/lib/paths";

type HotItem = { id: string; title: string; locale: Locale };

const RANK_CLS = ["r1", "r2", "r3"];

// 头条搜索页右栏「头条热榜」：排行 + 换一换（重新拉取榜单）。
export default function SearchHotBoard({ locale, initial }: { locale: Locale; initial: HotItem[] }) {
  const d = getDict(locale);
  const [list, setList] = useState<HotItem[]>(initial);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/stats/hot?locale=${locale}&limit=10`);
      const j = await r.json();
      const items: HotItem[] = (j.items || []).map((x: any) => ({ id: String(x.id), title: String(x.title || ""), locale: (x.locale as Locale) || locale }));
      if (items.length) setList(items);
    } catch {
      /* 保持原榜单 */
    } finally {
      setBusy(false);
    }
  };

  if (!list.length) return null;
  return (
    <div className="sp-hot">
      <div className="sp-hot-head">
        <h3>{d.hotTitle}</h3>
        <button type="button" className={"sp-hot-refresh" + (busy ? " spinning" : "")} onClick={refresh}>
          ⟳ {d.searchShuffle}
        </button>
      </div>
      {list.map((a, i) => (
        <div className="sp-hot-item" key={a.id}>
          <span className={`sp-hot-rank ${RANK_CLS[i] || ""}`}>{i + 1}</span>
          <Link prefetch={false} href={articleHref(a.locale, a.id)}>{a.title}</Link>
        </div>
      ))}
    </div>
  );
}
