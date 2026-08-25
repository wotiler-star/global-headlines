// 构建后生成 RSS：扫描 out/<locale>/article/<id>/index.html，提取 <title> 与
// <meta name="description">，写出 out/rss.xml（合并）与 out/<locale>/rss.xml（分语言）。
// 纯 Node（无依赖），在 `next build` 之后运行（见 package.json 的 build 脚本）。
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(fileURLToPath(new URL("../out/", import.meta.url)));
const SITE_URL = (process.env.SITE_URL || "https://global-headlines.example.com").replace(/\/$/, "");
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr"];

function escapeXml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extract(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const desc =
    (html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/i) || [])[1] ||
    (html.match(/<meta\s+content="([\s\S]*?)"\s+name="description"/i) || [])[1] ||
    "";
  return { title: title.trim(), desc: desc.trim() };
}

function buildFeed(items, title, link) {
  const now = new Date().toUTCString();
  const body = items
    .map(
      (it) => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid isPermaLink="true">${escapeXml(it.link)}</guid>
      <description>${escapeXml(it.desc)}</description>
      <pubDate>${now}</pubDate>
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <atom:link href="${escapeXml(link)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(title)}</description>
    <language>${items[0]?.lang || "zh"}</language>
    <lastBuildDate>${now}</lastBuildDate>
${body}
  </channel>
</rss>
`;
}

function collectLocale(locale) {
  const dir = join(OUT, locale, "article");
  if (!existsSync(dir)) return [];
  const items = [];
  for (const id of readdirSync(dir)) {
    const f = join(dir, id, "index.html");
    if (!existsSync(f)) continue;
    const html = readFileSync(f, "utf8");
    const { title, desc } = extract(html);
    if (!title) continue;
    items.push({
      title,
      desc,
      link: `${SITE_URL}/${locale}/article/${id}/index.html`,
      lang: locale,
    });
  }
  return items;
}

const all = [];
for (const loc of LOCALES) {
  const items = collectLocale(loc);
  if (items.length === 0) continue;
  const feed = buildFeed(items, `全球头条 (${loc})`, `${SITE_URL}/${loc}/rss.xml`);
  writeFileSync(join(OUT, loc, "rss.xml"), feed, "utf8");
  console.log(`[rss] wrote ${loc}/rss.xml (${items.length} items)`);
  all.push(...items);
}

if (all.length) {
  const combined = buildFeed(all, "全球头条 Global Headlines", `${SITE_URL}/rss.xml`);
  writeFileSync(join(OUT, "rss.xml"), combined, "utf8");
  console.log(`[rss] wrote rss.xml (combined ${all.length} items)`);
}
