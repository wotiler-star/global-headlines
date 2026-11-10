import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "@/i18n/config";

// Atom 1.0 feed —— 第二个标准订阅入口，修 /atom.xml 500。
// 之前没有此路由，/atom.xml 被 [locale] 动态段当作 locale="atom.xml" 渲染，
// localeMeta["atom.xml"] 为 undefined → 500。与 news-sitemap/llms.txt 同一类坑：
// 动态产物用 route handler 实时生成，不要写成运行期写入 public/ 的静态文件。
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.SITE_URL || "https://starteday.com").replace(/\/+$/, "");
const MAX_ITEMS = 60;

type Article = {
  id?: string; locale?: string; title?: string; summary?: string;
  publishedAt?: number | string; author?: string; tags?: string[]; images?: string[];
};

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function loadArticles(): Article[] {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "articles.json"), "utf8"));
    return Array.isArray(raw) ? raw : (raw.articles as Article[]) || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const arts = loadArticles()
    .filter((a) => a && a.id && a.title && a.locale && (locales as readonly string[]).includes(a.locale))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, MAX_ITEMS);

  const updated = arts.length
    ? new Date(Number(arts[0].publishedAt) || Date.now()).toISOString()
    : new Date().toISOString();

  const entries = arts.map((a) => {
    const loc = a.locale as string;
    const url = `${SITE_URL}/${loc}/article/${a.id}`;
    const date = new Date(Number(a.publishedAt) || Date.now()).toISOString();
    const img = Array.isArray(a.images) && a.images[0]
      ? (a.images[0].startsWith("http") ? a.images[0] : `${SITE_URL}${a.images[0].startsWith("/") ? "" : "/"}${a.images[0]}`)
      : "";
    const cats = (a.tags || []).slice(0, 2)
      .map((t) => `    <category term="${esc(t)}" />`).join("\n");
    return `  <entry>
    <title>${esc(a.title)}</title>
    <id>${esc(url)}</id>
    <link rel="alternate" type="text/html" href="${esc(url)}" />
    <updated>${date}</updated>
    <published>${date}</published>
    <summary type="text">${esc(a.summary || a.title)}</summary>
    <author><name>${esc(a.author || "starteday Editorial")}</name></author>
${cats}${img ? `\n    <link rel="enclosure" type="image/webp" href="${esc(img)}" />` : ""}
    <rights>Text: quote with attribution; images: see per-image CC licence at ${SITE_URL}/${loc}/about</rights>
  </entry>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>starteday · Global News</title>
  <subtitle>Original multilingual reporting on technology, science, business, culture and health.</subtitle>
  <id>${SITE_URL}/</id>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/atom.xml" />
  <link rel="alternate" type="text/html" href="${SITE_URL}/" />
  <link rel="related" type="application/rss+xml" href="${SITE_URL}/rss.xml" />
  <updated>${updated}</updated>
  <rights>© ${new Date().getUTCFullYear()} starteday</rights>
  <generator uri="${SITE_URL}" version="1.0">starteday</generator>
  <icon>${SITE_URL}/icons/icon-512.png</icon>
  <logo>${SITE_URL}/brand/og-cover.png</logo>
${entries}
</feed>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
