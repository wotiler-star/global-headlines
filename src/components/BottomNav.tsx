"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import LanguageSwitcher from "./LanguageSwitcher";
import { homeHref } from "@/lib/paths";

export default function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() || homeHref(locale);
  const sp = useSearchParams();
  const cat = sp.get("cat");
  const d = getDict(locale);
  const [openLang, setOpenLang] = useState(false);

  const base = homeHref(locale);
  const view = sp.get("view");
  const isHome = pathname === base && (!cat || cat === "recommend") && view !== "bookmarks";
  const isVideo = cat === "video";
  const isCat = !!cat && cat !== "video" && cat !== "recommend";
  const isBookmarks = view === "bookmarks";

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <Link href={base} className={`bn-item${isHome ? " active" : ""}`}>
        <span className="bn-icon">🏠</span>
        <span className="bn-label">{d.navHome}</span>
      </Link>
      <Link href={`${base}?cat=video`} className={`bn-item${isVideo ? " active" : ""}`}>
        <span className="bn-icon">▶</span>
        <span className="bn-label">{d.navVideo}</span>
      </Link>
      <Link href={`${base}?view=bookmarks`} className={`bn-item${isBookmarks ? " active" : ""}`}>
        <span className="bn-icon">♥</span>
        <span className="bn-label">{d.navBookmarks}</span>
      </Link>
      <Link href={`${base}?cat=world`} className={`bn-item${isCat ? " active" : ""}`}>
        <span className="bn-icon">☰</span>
        <span className="bn-label">{d.navCategories}</span>
      </Link>
      <button
        type="button"
        className={`bn-item bn-lang${openLang ? " active" : ""}`}
        onClick={() => setOpenLang((v) => !v)}
        aria-expanded={openLang}
      >
        <span className="bn-icon">🌐</span>
        <span className="bn-label">{d.navLanguage}</span>
      </button>
      {openLang && (
        <div className="lang-popover">
          <LanguageSwitcher locale={locale} />
        </div>
      )}
    </nav>
  );
}
