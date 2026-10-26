"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

type Item = Article & { commentCount?: number };

// 热门讨论：优先展示真实评论最多的稿件；不足时以主信息流趋势稿补足，评论数为 0 则不显示徽标。
export default function DiscussBoard({
  locale,
  items,
}: {
  locale: Locale;
  items: Article[];
}) {
  const d = getDict(locale);
  const [list, setList] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/articles?locale=${locale}&sort=comments&limit=8`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const hot: Item[] = (j && j.articles) || [];
        const have = new Set(hot.map((a) => a.id));
        const merged: Item[] = [...hot];
        for (const a of items) {
          if (merged.length >= 8) break;
          if (!have.has(a.id)) merged.push({ ...a, commentCount: 0 });
        }
        setList(merged);
      })
      .catch(() => setList(items.map((a) => ({ ...a, commentCount: 0 }))));
    return () => {
      alive = false;
    };
  }, [locale, items]);

  if (list.length === 0) return null;
  return (
    <div className="panel">
      <h3>
        <span className="bar" />
        {d.discussTitle}
      </h3>
      {list.map((a, i) => (
        <div className="trending-item" key={a.id}>
          <span className={`rank r${Math.min(i + 1, 4)}`}>{i + 1}</span>
          <Link href={articleHref(a.locale, a.id)} className="t-title">
            {a.title}
          </Link>
          {a.commentCount ? (
            <span className="hot-val hot-comments">💬 {a.commentCount}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
