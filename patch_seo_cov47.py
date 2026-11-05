# -*- coding: utf-8 -*-
"""patch_seo_cov47.py — Google 收录专项 SEO 修复（bytes 精确替换 + 断言）

问题清单（来自 seo_audit_cov47.py 线上实证）：
  1) 登录/注册/写作/会员/后台页可索引，且 robots.txt 的 /admin/ 规则并不匹配 /*/admin
  2) 分类页 title/description 与首页完全相同，sitemap 却收录了 ~72 个 canonical 指向首页的 URL
  3) 文章页结构化数据里的图片是相对路径（Google 要求绝对 URL）、publisher 缺 logo
  4) sitemap 的 lastModified 一律用构建时间，虚报更新频率
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NOINDEX = "robots: { index: false, follow: false }"


def repl(rel, pairs):
    p = ROOT / rel
    s = p.read_bytes()
    for pair in pairs:
        old, new = pair[0], pair[1]
        want = pair[2] if len(pair) > 2 else 1
        ob, nb = old.encode("utf-8"), new.encode("utf-8")
        n = s.count(ob)
        if n != want:
            sys.exit(f"[patch] {rel}: 期望 {want} 次，实际 {n}: {old[:70]!r}")
        s = s.replace(ob, nb)
    p.write_bytes(s)
    print(f"[patch] {rel}: {len(pairs)} 处")


# ---- 1. 会员 / 后台页 noindex（允许抓取才能读到 noindex）----
repl("src/app/[locale]/login/page.tsx", [(
    'return isLocale(loc) ? { title: getDict(loc).authLoginTitle, robots: { index: true, follow: true } } : { title: "Login" };',
    'return isLocale(loc)\n'
    '    ? { title: getDict(loc).authLoginTitle, ' + NOINDEX + ' }\n'
    '    : { title: "Login", ' + NOINDEX + ' };',
)])
repl("src/app/[locale]/register/page.tsx", [(
    '    ? { title: getDict(loc).authJoinTitle, robots: { index: true, follow: true } }\n    : { title: "Register" };',
    '    ? { title: getDict(loc).authJoinTitle, ' + NOINDEX + ' }\n'
    '    : { title: "Register", ' + NOINDEX + ' };',
)])
repl("src/app/[locale]/write/page.tsx", [(
    "  return { title: getDict(loc).memberWrite };",
    "  return { title: getDict(loc).memberWrite, " + NOINDEX + " };",
)])
repl("src/app/[locale]/me/page.tsx", [(
    "  return { title: getDict(loc).memberCenter };",
    "  return { title: getDict(loc).memberCenter, " + NOINDEX + " };",
)])
repl("src/app/[locale]/admin/page.tsx", [
    (
        'import { isLocale, Locale } from "@/i18n/config";',
        'import type { Metadata } from "next";\nimport { isLocale, Locale } from "@/i18n/config";',
    ),
    (
        'export const dynamic = "force-dynamic";',
        'export const dynamic = "force-dynamic";\n\n'
        'export const metadata: Metadata = {\n'
        '  title: "Admin",\n'
        '  ' + NOINDEX + ',\n'
        '};',
    ),
])

# ---- 2. robots.txt：只拦 API，会员页靠页面级 noindex ----
repl("src/app/robots.ts", [(
    '        disallow: ["/api/", "/admin/"],',
    '        // 会员/后台页用页面级 noindex，不能在这里 disallow，\n'
    '        // 否则 Googlebot 抓不到页面也就读不到 noindex 标记。\n'
    '        disallow: ["/api/"],',
)])

# ---- 3. 首页：分类页差异化 title / description ----
repl("src/app/[locale]/page.tsx", [
    (
        'import { isLocale, Locale, locales, ogLocale } from "@/i18n/config";',
        'import { isLocale, Locale, locales, ogLocale, isCategory, Category } from "@/i18n/config";',
    ),
    (
        'export async function generateMetadata({\n  params,\n}: {\n  params: Promise<{ locale: string }>;\n}): Promise<Metadata> {\n  const { locale } = await params;\n  const loc = locale as Locale;\n  const alts = buildAlternates(loc, "");\n  const d = getDict(loc);',
        'export async function generateMetadata({\n  params,\n  searchParams,\n}: {\n  params: Promise<{ locale: string }>;\n  searchParams: Promise<{ cat?: string }>;\n}): Promise<Metadata> {\n'
        '  const { locale } = await params;\n  const sp = await searchParams;\n'
        '  const loc = locale as Locale;\n  const alts = buildAlternates(loc, "");\n  const d = getDict(loc);\n'
        '  // cov47：分类页与首页共用模板，若无差异化元数据会被 Google 判为重复内容。\n'
        '  const catName = typeof sp.cat === "string" && isCategory(sp.cat) && sp.cat !== "recommend"\n'
        '    ? d.categories[sp.cat as Category]\n    : null;\n'
        '  const pageTitle = catName ? `${catName} · ${d.siteName}` : d.homeTitle;\n'
        '  const pageDesc = catName ? `${d.homeDesc} 当前栏目：${catName}。` : d.homeDesc;',
    ),
    ("title: d.homeTitle,", "title: pageTitle,", 3),
    ("description: d.homeDesc,", "description: pageDesc,", 3),
])

# ---- 4. 文章页结构化数据：绝对图片 URL + publisher logo ----
repl("src/app/[locale]/article/[id]/page.tsx", [
    (
        'import { absUrl, buildArticleAlternates } from "@/lib/site";',
        'import { absUrl, buildArticleAlternates, SITE_URL } from "@/lib/site";',
    ),
    (
        "                image: article.images,",
        "                image: (article.images || []).map((p: string) =>\n"
        "                  p.startsWith(\"http\") ? p : `${SITE_URL}${p.startsWith(\"/\") ? \"\" : \"/\"}${p}`\n"
        "                ),",
    ),
    (
        '                publisher: { "@type": "Organization", name: d.siteName },',
        '                publisher: {\n'
        '                  "@type": "Organization",\n'
        '                  name: d.siteName,\n'
        '                  logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },\n'
        '                },',
    ),
])

# ---- 5. sitemap：只留可索引 URL + 真实 lastModified ----
(ROOT / "src/app/sitemap.ts").write_text(
    '''import type { MetadataRoute } from "next";
import { locales, categories, Locale } from "@/i18n/config";
import { getArticles } from "@/data/newsSource";
import { absUrl, buildSitemapAlternates, buildArticleAlternates } from "@/lib/site";

export const dynamic = "force-static";

// cov47：sitemap 只收录「canonical 指向自身」的 URL。
// 分类页 /?cat=... 的 canonical 指向语言首页，收录它们会产生大量重复内容信号，
// 因此从 sitemap 移除；Google 仍可通过首页导航发现这些栏目。
// lastModified 改用文章真实发布时间，避免每次构建都把全部 URL 标成「刚更新」。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  for (const l of locales) {
    const loc = l as Locale;
    const home = buildSitemapAlternates(loc, "");

    const articleTimes = new Map<string, number>();
    for (const a of await getArticles(loc)) articleTimes.set(a.id, a.publishedAt || 0);
    for (const c of categories) {
      for (const a of await getArticles(loc, c)) articleTimes.set(a.id, a.publishedAt || 0);
    }
    const times = [...articleTimes.values()].filter(Boolean);
    const latest = times.length ? new Date(Math.max(...times)) : undefined;

    urls.push({
      url: absUrl(loc, ""),
      lastModified: latest,
      alternates: { languages: home.languages },
    });

    for (const [id, ts] of articleTimes) {
      const alts = buildArticleAlternates(loc, `/article/${id}`);
      urls.push({
        url: absUrl(loc, `/article/${id}`),
        lastModified: ts ? new Date(ts) : latest,
        alternates: { languages: alts.languages },
      });
    }
  }

  return urls;
}
''',
    encoding="utf-8",
)
print("[patch] src/app/sitemap.ts: 重写")
print("[patch] 全部完成 ✅")
