"use client";

import { useEffect, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";
import Link from "next/link";

const KEY = "gh_read_history";

type HistoryItem = { id: string; cat: string };

// 猜你喜欢 (recommendations): reads the local read-history and boosts the
// categories the user engages with most, while de-duplicating already-read
// articles. A lightweight client-side stand-in for a personalization service.
export default function RecommendRail({
  locale,
  articles,
}: {
  locale: Locale;
  articles: Article[];
}) {
  const d = getDict(locale);
  const [recs, setRecs] = useState<Article[]>([]);

  useEffect(() => {
    let hist: HistoryItem[] = [];
    try {
      hist = JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryItem[];
    } catch {
      hist = [];
    }
    const readIds = new Set(hist.map((h) => h.id));
    const catBoost = new Map<string, number>();
    hist.forEach((h) => catBoost.set(h.cat, (catBoost.get(h.cat) || 0) + 1));

    const pool = articles.filter((a) => !readIds.has(a.id));
    pool.sort(
      (a, b) =>
        (catBoost.get(b.category) || 0) - (catBoost.get(a.category) || 0)
    );
    setRecs(pool.slice(0, 6));
  }, [articles]);

  if (recs.length === 0) return null;

  return (
    <div className="panel">
      <h3>
        <span className="bar" />
        {d.recommendTitle}
      </h3>
      {recs.map((a) => (
        <div className="side-card" key={a.id}>
          <Link href={articleHref(a.locale, a.id)} className="thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.images[0]} alt={a.title} loading="lazy" />
          </Link>
          <Link href={articleHref(a.locale, a.id)} className="sc-title">
            {a.title}
          </Link>
        </div>
      ))}
    </div>
  );
}
