import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, isLocale } from "./i18n/config";

const PUBLIC = /\.[^/]+$/; // 静态资源后缀

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 兼容旧版 /index.html 后缀链接（CloudStudio 静态导出产物 / 浏览器补全）
  if (pathname.endsWith("/index.html")) {
    const url = req.nextUrl.clone();
    const stripped = pathname.slice(0, -"/index.html".length) || "/";
    if (stripped === "/") {
      const accept = (req.headers.get("accept-language") || "").toLowerCase();
      const preferred = locales.find((l) => accept.includes(l));
      const locale: string = preferred && isLocale(preferred) ? preferred : defaultLocale;
      url.pathname = `/${locale}`;
    } else {
      url.pathname = stripped;
    }
    return NextResponse.redirect(url);
  }

  if (PUBLIC.test(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return;
  }

  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  // 依据 Accept-Language 选择语言，否则回退默认语言
  const accept = (req.headers.get("accept-language") || "").toLowerCase();
  const preferred = locales.find((l) => accept.includes(l));
  const locale: string = preferred && isLocale(preferred) ? preferred : defaultLocale;

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
