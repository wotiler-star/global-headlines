import Link from "next/link";
import { Suspense } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import SearchBox from "./SearchBox";
import CategoryNav from "./CategoryNav";
import { homeHref } from "@/lib/paths";

export default function Header({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href={homeHref(locale)} className="logo">
          <span className="logo-mark">头</span>
          {d.siteName}
        </Link>
        <Suspense
          fallback={
            <form className="search-form" role="search">
              <input className="search-input" type="search" placeholder={d.searchPlaceholder} aria-label={d.searchPlaceholder} readOnly />
              <button className="search-btn" type="submit">🔍</button>
            </form>
          }
        >
          <SearchBox locale={locale} />
        </Suspense>
        <ThemeToggle />
        <LanguageSwitcher locale={locale} />
      </div>
      <Suspense fallback={null}>
        <CategoryNav locale={locale} />
      </Suspense>
    </header>
  );
}
