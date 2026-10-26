"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

type Sug = { text: string; type: string; cat?: string };

export default function SearchBox({ locale, variant = "header" }: { locale: Locale; variant?: "header" | "hero" }) {
  const d = getDict(locale);
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") || "");
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSugs = useCallback(
    (q: string) => {
      if (timer.current) clearTimeout(timer.current);
      const t = q.trim();
      if (!t) {
        setSugs([]);
        setOpen(false);
        return;
      }
      timer.current = setTimeout(() => {
        fetch(`/api/search/suggest?locale=${locale}&q=${encodeURIComponent(t)}&limit=8`)
          .then((r) => r.json())
          .then((j) => {
            setSugs(j.suggestions || []);
            setOpen(true);
            setActive(-1);
          })
          .catch(() => setSugs([]));
      }, 180);
    },
    [locale]
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // 分类建议 → 进分类筛选结果（保留已输入的关键词，收窄到该分类）；
  // 文章标题建议 → 以该标题为关键词搜索。
  const go = (s: Sug) => {
    setOpen(false);
    const t = s.text.trim();
    if (s.type === "category" && s.cat) {
      const sp = new URLSearchParams({ cat: s.cat });
      const typed = value.trim();
      if (typed) sp.set("q", typed);
      router.push(`/${locale}/search?${sp.toString()}`);
    } else if (t) {
      router.push(`/${locale}/search?q=${encodeURIComponent(t)}`);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    fetchSugs(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, sugs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (active >= 0 && sugs[active]) {
        e.preventDefault();
        go(sugs[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={"search-box" + (variant === "hero" ? " sb-hero" : "")} ref={boxRef}>
      <form
        className="search-form"
        action={`/${locale}/search`}
        method="get"
        role="search"
        onSubmit={(e) => {
          if (!value.trim()) e.preventDefault();
        }}
      >
        <input
          className="search-input"
          type="search"
          name="q"
          value={value}
          placeholder={d.searchPlaceholder}
          aria-label={d.searchPlaceholder}
          autoComplete="off"
          onChange={onChange}
          onFocus={() => sugs.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button className="search-btn" type="submit">🔍</button>
      </form>
      {open && sugs.length > 0 && (
        <ul className="search-suggest" role="listbox">
          {sugs.map((s, i) => (
            <li
              key={s.text}
              data-type={s.type}
              className={"ss-item" + (i === active ? " active" : "")}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ss-ico">{s.type === "category" ? "📂" : "🔍"}</span>
              <span className="ss-text">{s.text}</span>
              {s.type === "category" && <span className="ss-kind">{d.sugCategory}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
