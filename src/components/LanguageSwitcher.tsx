"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeMeta, Locale } from "@/i18n/config";
import { swapLocale } from "@/lib/paths";

// 手动切换语言 → 写入 gh_locale cookie（180 天），优先级高于任何 IP 自动判断。
// 否则用户选了英文，下次访问根路径又会被按地区切回。
function remember(locale: string) {
  try {
    document.cookie = `gh_locale=${encodeURIComponent(locale)};path=/;max-age=${60 * 60 * 24 * 180};samesite=lax;secure`;
  } catch { /* ignore */ }
}

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
            onClick={() => remember(l)}
          >
            {localeMeta[l].name}
          </Link>
        );
      })}
    </nav>
  );
}
