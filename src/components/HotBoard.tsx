"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Locale, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

type Item = {
  id: string;
  title: string;
  locale: Locale;
  category: string;
  publishedAt: number;
  views: number;
  comments: number;
  score: number;
};

// 热榜：榜单由服务端 /api/stats/hot 计算（窗口阅读 + 评论 + 24h 时效衰减 + 内容热度），
// 支持"全站 / 各分类"切换。SSR 首帧沿用服务端传入的 items（与静态 HTML 一致），挂载后按分类重新拉取。
export default function HotBoard({ locale, items }: { locale: Locale; items: Article[] }) {
  const d = getDict(locale);
  const [cat, setCat] = useState<string>("all");
  const [list, setList] = useState<Item[]>(
    items.map((a) => ({
      id: a.id,
      title: a.title,
      locale: a.locale,
      category: a.category,
      publishedAt: a.publishedAt,
      views: 0,
      comments: 0,
      score: 0,
    }))
  );

  useEffect(() => {
    let alive = true;
    const url = `/api/stats/hot?locale=${locale}&limit=10${cat !== "all" ? `&category=${cat}` : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        const rows: Item[] = (j.items || []).map((x: any) => ({
          id: String(x.id),
          title: String(x.title || ""),
          locale: (x.locale as Locale) || locale,
          category: String(x.category || ""),
          publishedAt: Number(x.publishedAt || 0),
          views: Number(x.views || 0),
          comments: Number(x.comments || 0),
          score: Number(x.score || 0),
        }));
        setList(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale, cat]);

  const tabs: { key: string; label: string }[] = [
    { key: "all", label: d.hotAll },
    ...categories.filter((c) => c !== "recommend").map((c) => ({ key: c, label: d.categories[c] })),
  ];

  return (
    <div className="panel hot-board">
      <h3>
        <span className="bar" />
        {d.hotTitle}
      </h3>
      <div className="hot-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip${cat === t.key ? " active" : ""}`}
            aria-pressed={cat === t.key}
            onClick={() => setCat(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {list.map((a, i) => (
        <div className="trending-item" key={a.id}>
          <span className={`rank r${Math.min(i + 1, 4)}`}>{i + 1}</span>
          <Link href={articleHref(a.locale, a.id)} className="t-title">
            {a.title}
          </Link>
          <span className="hot-val">
            {a.views ? <span className="hot-views">🔥 {a.views}</span> : null}
            {a.comments ? <span className="hot-comments">💬 {a.comments}</span> : null}
          </span>
        </div>
      ))}
      {list.length === 0 ? <div className="hot-empty">{d.hotEmpty}</div> : null}
    </div>
  );
}
