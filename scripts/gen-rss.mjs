// 生成 RSS：直接读取 data/articles.json（collect-articles.mjs 写的可读镜像），
// 写出 public/rss.xml（合并）与 public/<locale>/rss.xml（分语言）。
// 纯 Node 无依赖；构建后 / 容器启动时运行均可（幂等覆盖写）。
// 历史：旧版扫描 out/<locale>/article/<id>/index.html，那是 CloudStudio 静态导出
// 时代的逻辑，Docker(next start) 部署下 out/ 不存在，导致 RSS 从未生成（线上 404/500）。
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("../", import.meta.url)));
const DATA = join(ROOT, "data", "articles.json");
const PUB = join(ROOT, "public");
const SITE_URL = (process.env.SITE_URL || "https://www.starteday.com").replace(/\/$/, "");
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr"];
const MAX_ITEMS = 50;

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildFeed(items, title, link, lang) {
  const now = new Date().toUTCString();
  const body = items
    .map(
      (it) => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid isPermaLink="true">${escapeXml(it.link)}</guid>
      <description>${escapeXml(it.desc)}</description>
      <pubDate>${escapeXml(new Date(it.publishedAt).toUTCString())}</pubDate>${it.image ? `\n      <enclosure url="${escapeXml(it.image)}" type="image/jpeg" />` : ""}
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
    <language>${lang}</language>
    <lastBuildDate>${now}</lastBuildDate>
${body}
  </channel>
</rss>
`;
}

if (!existsSync(DATA)) {
  console.log("[rss] data/articles.json 不存在，跳过（容器启动 collect 后再生成）");
  process.exit(0);
}

let articles = [];
try {
  articles = JSON.parse(readFileSync(DATA, "utf8"));
} catch (e) {
  console.log("[rss] articles.json 解析失败，跳过:", e.message);
  process.exit(0);
}
if (!Array.isArray(articles) || articles.length === 0) {
  console.log("[rss] 无文章数据，跳过");
  process.exit(0);
}

mkdirSync(PUB, { recursive: true });

const all = [];
for (const loc of LOCALES) {
  const items = articles
    .filter((a) => a && a.locale === loc && a.title && a.id)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, MAX_ITEMS)
    .map((a) => ({
      title: a.title,
      desc: a.summary || a.title,
      link: `${SITE_URL}/${loc}/article/${a.id}`,
      publishedAt: a.publishedAt || Date.now(),
      image: Array.isArray(a.images) ? a.images[0] : undefined,
    }));
  if (items.length === 0) continue;
  const feed = buildFeed(items, `全球头条 (${loc})`, `${SITE_URL}/${loc}/rss.xml`, loc);
  const dir = join(PUB, loc);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "rss.xml"), feed, "utf8");
  console.log(`[rss] wrote ${loc}/rss.xml (${items.length} items)`);
  all.push(...items);
}

if (all.length) {
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  const top = all.slice(0, 100);
  const combined = buildFeed(top, "全球头条 Global Headlines", `${SITE_URL}/rss.xml`, "zh");
  writeFileSync(join(PUB, "rss.xml"), combined, "utf8");
  console.log(`[rss] wrote rss.xml (combined ${top.length} items)`);
}
