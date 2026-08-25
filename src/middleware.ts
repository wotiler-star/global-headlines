import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, isLocale } from "./i18n/config";

const PUBLIC = /\.[^/]+$/; // 静态资源后缀

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
