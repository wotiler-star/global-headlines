import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, isLocale, isCategory } from "./i18n/config";
import { acceptLanguageToLocale, countryToLocale } from "./i18n/geoLocale";

const PUBLIC = /\.[^/]+$/; // 静态资源后缀

// ---------------------------------------------------------------------------
// 搜索引擎爬虫豁免：绝不能按 IP 把爬虫重定向到单一语种。
// Googlebot 主要从美国 IP 抓取，若被重定向到 /en，其余 7 个语种版本将无法被
// 发现/索引（Google 官方明确警告过这种「按 IP 强制重定向」的做法）。
// 爬虫访问任意 /xx/ 路径时本就不重定向；访问根路径时给默认语种即可，
// 完整 hreflang + sitemap 会引导它抓取所有语言版本。
// ---------------------------------------------------------------------------
const BOT_UA = /(googlebot|bingbot|baiduspider|yandex(bot)?|duckduckbot|sogou|360spider|sosospider|slurp|applebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|semrushbot|ahrefsbot|mj12bot|petalbot|bytespider|gptbot|claudebot|ccbot|ia_archiver|curl|wget|python-requests|headlesschrome|crawler|spider|bot\b)/i;

/** 从代理头取国家码（CDN / 反代可注入；自建 nginx 目前未注入，留作扩展） */
function countryFromHeaders(req: NextRequest): string | undefined {
  const candidates = [
    req.headers.get("cf-ipcountry"),          // Cloudflare
    req.headers.get("x-vercel-ip-country"),   // Vercel
    req.headers.get("x-country-code"),        // 自建反代自定义
    req.headers.get("x-geo-country"),
  ];
  for (const c of candidates) {
    const v = (c || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX") return v;
  }
  return undefined;
}

/** 首次访客选择语种：国家头 > Accept-Language > 国际通用语 en */
function pickLocale(req: NextRequest): string {
  const country = countryFromHeaders(req);
  if (country) return countryToLocale(country);
  // 德语/意语/俄语等站点暂不支持的语种回退 en，而不是中文——
  // 面向全球网友时 en 是更中性的兜底，随后 /api/geo 会按 IP 精修。
  return acceptLanguageToLocale(req.headers.get("accept-language")) || "en";
}

// 注意：本 middleware **不写** gh_locale cookie。
// 语种记忆统一由客户端负责（用户手动切换 / IP 判断后的自动切换），
// 否则服务端按 Accept-Language 抢先写入会锁死语种，让后续 IP 精确定位失效。

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 兼容旧版 /index.html 后缀链接（CloudStudio 静态导出产物 / 浏览器补全）
  if (pathname.endsWith("/index.html")) {
    const url = req.nextUrl.clone();
    const stripped = pathname.slice(0, -"/index.html".length) || "/";
    if (stripped === "/") {
      url.pathname = `/${pickLocale(req)}`;
    } else {
      url.pathname = stripped;
    }
    return NextResponse.redirect(url);
  }

  // cov65：非法栏目参数直接返回规范 404，不让请求进入 Next 渲染。
  // category 页是 force-static + dynamicParams=false；对未预生成的 [cat]，
  // Next 会在 responseGenerator 内部抛 NoFallbackError 来实现 404（对外确为 404，
  // 但会持续污染 error 日志，并让爬虫反复占用渲染 worker）。
  // 白名单与 category/page.tsx 的 generateStaticParams 完全一致：
  // categories 去掉 recommend（recommend 即语言首页，不建独立栏目页）。
  // 必须放在 PUBLIC 早返回之前，否则 /zh/category/wp-login.php 这类带点探测会漏过。
  const catPath = /^\/([^/]+)\/category\/([^/]+)\/?$/.exec(pathname);
  if (catPath && isLocale(catPath[1])) {
    let slug = catPath[2];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* 非法百分号编码 → 必然不命中白名单 */
    }
    if (!isCategory(slug) || slug === "recommend") {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  if (PUBLIC.test(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return;
  }

  // cov62：旧版栏目页 /<locale>?cat=<x> 被 Google 判为首页重复内容、长期「已发现未收录」。
  // 现改为静态栏目页 /<locale>/category/<x>，这里把已爬取的 ?cat= 参数 URL 301 过去，
  // 并清掉其它参数（栏目落地页为静态，不消费查询串）。必须放在语种前缀早返回之前，
  // 否则 /zh?cat=world 会被「显式带语种前缀不重定向」规则漏掉。
  const catParam = req.nextUrl.searchParams.get("cat");
  if (
    catParam &&
    isCategory(catParam) &&
    catParam !== "recommend" &&
    !pathname.includes("/category/")
  ) {
    const localeSeg = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
    const locale = pathname === "/" ? defaultLocale : localeSeg ?? defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/category/${catParam}`;
    url.search = "";
    return NextResponse.redirect(url, { status: 301 });
  }

  // 显式带语种前缀的路径：绝对不重定向。
  // 这是多语言 SEO 的基石——每个 /xx/ URL 必须可被独立抓取、索引与分享，
  // 也保证用户从语言切换器点进某语言后不会被 IP 判断「纠正」回去。
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  // 爬虫豁免：根路径访问直接落到默认语种，不做任何地理判断。
  const ua = req.headers.get("user-agent") || "";
  if (BOT_UA.test(ua)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 已记住语种（手动切换或此前自动判断）→ 尊重用户选择
  const saved = req.cookies.get("gh_locale")?.value;
  const locale: string = saved && isLocale(saved) ? saved : pickLocale(req);

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
