"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

// 编辑推荐：管理员置顶（pinned）的稿件；无置顶时整块不显示。
export default function EditorPicks({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const [list, setList] = useState<Article[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/articles?locale=${locale}&pinned=1&limit=6`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setList(j.articles || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale]);

  if (list.length === 0) return null;
  return (
    <div className="panel">
      <h3>
        <span className="bar" />
        {d.editorPickTitle}
      </h3>
      <div className="pick-list">
        {list.map((a) => (
          <Link key={a.id} href={articleHref(a.locale, a.id)} className="pick-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pick-thumb"
              src={(a.images && a.images[0]) || ""}
              alt={a.title}
              loading="lazy"
            />
            <span className="pick-title">{a.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
