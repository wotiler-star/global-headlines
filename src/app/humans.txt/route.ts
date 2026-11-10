import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

// humans.txt：给记者、研究者、聚合器一份稳定的「谁在运营 / 如何引用 / 如何订阅」入口。
// 用 route handler 而非 public 静态文件，避免 /[locale] 段把未知路径误当语种渲染（500）。
export const dynamic = "force-static";

export function GET() {
  const txt = `/* humans.txt — starteday.com */
/* TEAM */
  Editorial desk: starteday (8 languages: zh, en, ja, ko, es, fr, pt, tr)
  Contact / corrections / citation policy: see /<locale>/about on this site.

/* SITE */
  Standards: HTML5, CSS3, RSS 2.0, Atom 1.0, schema.org JSON-LD, llms.txt
  Languages: Chinese, English, Japanese, Korean, Spanish, French, Portuguese, Turkish
  Content: original reporting and curated science/technology news with source attribution
  Images: Wikimedia Commons, author and license credited on each article and on /<locale>/about

/* REFERENCE ASSETS */
  About & citation guide: ${SITE_URL}/zh/about (and /en/about, /ja/about, /ko/about, /es/about, /fr/about, /pt/about, /tr/about)
  llms.txt: ${SITE_URL}/llms.txt
  Sitemap: ${SITE_URL}/sitemap.xml
  Google News sitemap: ${SITE_URL}/news-sitemap.xml
  RSS: ${SITE_URL}/rss.xml | Atom: ${SITE_URL}/atom.xml

/* LAST UPDATE */
  2026-11-10
`;
  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
