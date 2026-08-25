"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeMeta, Locale } from "@/i18n/config";
import { swapLocale } from "@/lib/paths";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() || `/${locale}`;
  return (
    <nav className="lang-switcher" aria-label="Language">
      {locales.map((l) => {
        const href = swapLocale(pathname, l);
        return (
          <Link
            key={l}
            href={href}
            hrefLang={localeMeta[l].hreflang}
            className={l === locale ? "active" : ""}
          >
            {localeMeta[l].name}
          </Link>
        );
      })}
    </nav>
  );
}
