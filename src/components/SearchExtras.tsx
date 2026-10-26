"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

export default function SearchExtras({ locale, q }: { locale: Locale; q: string }) {
  const d = getDict(locale);
  const router = useRouter();
  const [hist, setHist] = useState<string[]>([]);
  const [hot, setHot] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("search_history");
      if (raw) setHist(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!q) return;
    setHist((prev) => {
      const n = [q, ...prev.filter((x) => x !== q)].slice(0, 8);
      try { localStorage.setItem("search_history", JSON.stringify(n)); } catch {}
      return n;
    });
  }, [q]);

  useEffect(() => {
    fetch(`/api/stats/hot?locale=${locale}&limit=8`)
      .then((r) => r.json())
      .then((j) => setHot((j.items || []).map((x: { title: string }) => x.title)))
      .catch(() => {});
  }, [locale]);

  const go = (t: string) => router.push(`/${locale}/search?q=${encodeURIComponent(t)}`);
  const clear = () => {
    try { localStorage.removeItem("search_history"); } catch {}
    setHist([]);
  };

  if (hist.length === 0 && hot.length === 0) return null;
  return (
    <div className="search-extras">
      {hist.length > 0 && (
        <div className="se-block">
          <div className="se-head">
            <span>{d.searchHistory}</span>
            <button className="se-clear" onClick={clear}>{d.searchClear}</button>
          </div>
          <div className="se-chips">
            {hist.map((t) => (
              <button key={t} className="chip" onClick={() => go(t)}>{t}</button>
            ))}
          </div>
        </div>
      )}
      {hot.length > 0 && (
        <div className="se-block">
          <div className="se-head"><span>{d.searchHot}</span></div>
          <div className="se-chips">
            {hot.map((t, i) => (
              <button key={t} className="chip hot" onClick={() => go(t)}>{i + 1}. {t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
