// seoTools.ts — 动态 SEO 产物生成（news-sitemap.xml / llms.txt）。
// 与 scripts/gen-news-sitemap.mjs 同源逻辑，但改为请求时实时读取 volume 里的
// data/articles.json（在容器内即 /app/data/articles.json，由 reset-to-editorial.mjs 维护），
// 不依赖 Next 静态文件服务（生产态不会提供运行期新写入的 public/ 文件）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "@/i18n/config";

const SITE_URL = (process.env.SITE_URL || "https://starteday.com").replace(/\/$/, "");
const SITE_NAME = "starteday";
const WINDOW_HOURS = 48;
const MAX_URLS = 1000;

type Article = {
  id?: string;
  locale?: string;
  title?: string;
  publishedAt?: number | string;
  summary?: string;
};

function loadArticles(): Article[] {
  try {
    const DATA = join(process.cwd(), "data", "articles.json");
    const raw = JSON.parse(readFileSync(DATA, "utf8"));
    return Array.isArray(raw) ? raw : (raw.articles as Article[]) || [];
  } catch {
    return [];
  }
}

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildNewsSitemap(): string {
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const recent = loadArticles()
    .filter(
      (a) =>
        a &&
        a.id &&
        a.title &&
        a.locale &&
        (locales as readonly string[]).includes(a.locale) &&
        Number(a.publishedAt || 0) >= cutoff,
    )
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, MAX_URLS);

  const urls = recent
    .map((a) => {
      const loc = `${SITE_URL}/${a.locale}/article/${a.id}`;
      const date = new Date(Number(a.publishedAt)).toISOString().replace(/\.\d{3}Z$/, "Z");
      return `  <url>
    <loc>${esc(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(SITE_NAME)}</news:name>
        <news:language>${esc(a.locale as string)}</news:language>
      </news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>${esc(a.title as string)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
}

export function buildLlmsTxt(): string {
  const homeLinks = locales
    .map((l) => `- [${l} 首页](${SITE_URL}/${l}): starteday ${l} 语首页`)
    .join("\n");
  const latest = loadArticles()
    .filter(
      (a) =>
        a && a.id && a.title && a.locale && (locales as readonly string[]).includes(a.locale),
    )
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, 30)
    .map(
      (a) =>
        `- [${(a.title as string).replace(/[\[\]]/g, "")}](${SITE_URL}/${a.locale}/article/${a.id}): ${(a.summary || "").slice(0, 110)}`,
    )
    .join("\n");

  return `# ${SITE_NAME}

> starteday 是一个覆盖中文、英语、日语、韩语、西班牙语、法语、葡萄牙语、土耳其语的原创科技与科学资讯站。所有文章为独立撰写的原创稿件，配图来自 Wikimedia Commons 并在文内标注作者与许可。

## 语言入口

${homeLinks}

## 关于与引用规范

引用、转载或用于研究时，请先阅读各语种的关于页：其中给出规范引用格式、图片许可与署名政策、纠错渠道，是稳定的可引用入口。

${locales.map((l) => `- [${l} 关于与引用](${SITE_URL}/${l}/about)`).join("\n")}

## 订阅与站点地图

- [RSS](${SITE_URL}/rss.xml)
- [Atom](${SITE_URL}/atom.xml)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Google News Sitemap](${SITE_URL}/news-sitemap.xml)

## 最新文章

${latest}
`;
}
