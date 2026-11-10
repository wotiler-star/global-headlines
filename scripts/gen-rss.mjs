// 生成 RSS：直接读取 data/articles.json（collect-articles.mjs 写的可读镜像），
// 写出 public/rss.xml（合并）与 public/<locale>/rss.xml（分语言）。
// 纯 Node 无依赖；构建后 / 容器启动时运行均可（幂等覆盖写）。
// 历史：旧版扫描 out/<locale>/article/<id>/index.html，那是静态导出时代的逻辑，
// Docker(next start) 部署下 out/ 不存在，导致 RSS 从未生成（线上 404/500）。
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("../", import.meta.url)));
const DATA = join(ROOT, "data", "articles.json");
const PUB = join(ROOT, "public");
// 规范域是裸域（src/lib/site.ts 同值）。历史默认值误写 www，会让 feed 里的
// <link> 与 canonical 分裂成另一个主机；保持与构建期注入的 SITE_URL 一致。
const SITE_URL = (process.env.SITE_URL || "https://starteday.com").replace(/\/$/, "");
const MAX_ITEMS = 50;
const SITE_NAME = "starteday";

// cov42：语种清单从 i18n 单一真相源读取。此前这里硬编码 6 个语种，
// 站点却是 8 语种，导致 /pt/rss.xml 与 /tr/rss.xml 长期 404（数据其实各有 40/130 篇）。
function readLocales() {
  const fallback = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
  try {
    const src = readFileSync(join(ROOT, "src", "i18n", "config.ts"), "utf8");
    const m = src.match(/export const locales\s*=\s*\[([^\]]+)\]/);
    if (!m) throw new Error("locales 声明未找到");
    const list = [...m[1].matchAll(/["']([a-z]{2})["']/g)].map((x) => x[1]);
    if (list.length < 2) throw new Error("locales 过短");
    return list;
  } catch (e) {
    console.warn("[rss] 解析 config.ts 失败，回退默认语种:", e.message);
    return fallback;
  }
}
const LOCALES = readLocales();

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 图片路径必须是绝对 URL：RSS 阅读器/聚合平台不解析站点相对路径，
// 相对 enclosure 既加载不出图，也不会把图片来源回链到本站。
function absAsset(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

/**
 * @param items    文章条目
 * @param title    feed 标题
 * @param feedUrl  feed 自身 URL（仅用于 atom:link rel=self）
 * @param siteLink 站点首页 URL（channel/link 应指向站点，而非 feed 本身）
 * @param lang     语种
 * @param sourceUrl 每个 item 的 <source url>：聚合器保留的来源回链
 */
function buildFeed(items, title, feedUrl, siteLink, lang, sourceUrl) {
  const now = new Date().toUTCString();
  const body = items
    .map((it) => {
      const img = absAsset(it.image);
      const enclosure = img
        ? `\n      <enclosure url="${escapeXml(img)}" type="image/webp" length="0" />` : "";
      const source = sourceUrl
        ? `\n      <source url="${escapeXml(sourceUrl)}">${escapeXml(title)}</source>` : "";
      const cats = (it.tags || []).slice(0, 3)
        .map((t) => `\n      <category>${escapeXml(t)}</category>`).join("");
      return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid isPermaLink="true">${escapeXml(it.link)}</guid>
      <description>${escapeXml(it.desc)}</description>
      <pubDate>${escapeXml(new Date(it.publishedAt).toUTCString())}</pubDate>${enclosure}${cats}${source}
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteLink)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(title)} — ${SITE_NAME} 原创多语种资讯</description>
    <language>${lang}</language>
    <copyright>© ${new Date().getUTCFullYear()} ${SITE_NAME}. Text: quote with attribution; images: see per-image CC licence.</copyright>
    <managingEditor>editorial@starteday.com (${SITE_NAME} Editorial)</managingEditor>
    <webMaster>editorial@starteday.com (${SITE_NAME})</webMaster>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${SITE_URL}/icons/icon-512.png</url>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(siteLink)}</link>
    </image>
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
  const feedUrl = `${SITE_URL}/${loc}/rss.xml`;
  const siteLink = `${SITE_URL}/${loc}`;
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
      tags: Array.isArray(a.tags) ? a.tags : [],
    }));
  // 即便某语种暂时没有文章也写出空 feed：页头 <link rel=alternate> 指向的
  // 订阅地址必须始终返回 200，否则阅读器会报错、SEO 也会抓到 404。
  if (items.length === 0) console.log(`[rss] ${loc} 暂无文章，写出空 feed`);
  const feed = buildFeed(items, `starteday (${loc})`, feedUrl, siteLink, loc, feedUrl);
  const dir = join(PUB, loc);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "rss.xml"), feed, "utf8");
  console.log(`[rss] wrote ${loc}/rss.xml (${items.length} items)`);
  all.push(...items);
}

if (all.length) {
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  const top = all.slice(0, 100);
  const combined = buildFeed(
    top, "starteday · Global News", `${SITE_URL}/rss.xml`, SITE_URL, "zh", `${SITE_URL}/rss.xml`
  );
  writeFileSync(join(PUB, "rss.xml"), combined, "utf8");
  console.log(`[rss] wrote rss.xml (combined ${top.length} items)`);
}
