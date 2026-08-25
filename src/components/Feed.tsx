"use client";

import { useSearchParams } from "next/navigation";
import { Locale, Category, isCategory } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import NewsCard from "./NewsCard";
import TrendingSidebar from "./TrendingSidebar";

export default function Feed({
  locale,
  articles,
  trending,
}: {
  locale: Locale;
  articles: Article[];
  trending: Article[];
}) {
  const sp = useSearchParams();
  const catParam = sp.get("cat");
  const qParam = sp.get("q");
  const active: Category =
    catParam && isCategory(catParam) ? catParam : "recommend";
  const d = getDict(locale);

  let list = articles;
  if (active !== "recommend") {
    list = list.filter((a) => a.category === active);
  }
  const q = qParam && qParam.trim() ? qParam.trim().toLowerCase() : "";
  if (q) {
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q)
    );
  }

  return (
    <>
      {q && (
        <div className="section-title">
          <span className="bar" />
          “{qParam}” · {list.length} {d.relatedTitle}
        </div>
      )}
      <div className="layout">
        <div className="feed">
          {list.length === 0 ? (
            <div className="empty">{d.notFoundDesc}</div>
          ) : (
            list.map((a) => <NewsCard key={a.id} article={a} />)
          )}
        </div>
        <TrendingSidebar articles={trending} />
      </div>
    </>
  );
}
