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
  // 这是导航控件，不是语言版本声明：文章页的 alternate 由 head <link rel=alternate>
  // 与正文真实版本链接给出。给这些锚点挂 hrefLang 会与 head 的 hreflang 指向冲突
  // （文章页上同一语言码同时指向首页与文章页），故刻意不声明。
  return (
    <nav className="lang-switcher" aria-label="Language">
      {locales.map((l) => {
        const href = swapLocale(pathname, l);
        return (
          <Link
            key={l}
            href={href}
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
