// seoTools.ts — 动态 SEO 产物生成（news-sitemap.xml / llms.txt / llms-full.txt）。
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
  category?: string;
  tags?: string[];
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

// 纯文本索引里的一行：压掉换行与 Markdown 结构符，避免破坏列表
function flat(s = "") {
  return String(s).replace(/[\r\n\t]+/g, " ").replace(/[\[\]]/g, "").replace(/\s{2,}/g, " ").trim();
}

function articleUrl(a: Article) {
  return `${SITE_URL}/${a.locale}/article/${a.id}`;
}

function validArticles(): Article[] {
  return loadArticles()
    .filter((a) => a && a.id && a.title && a.locale && (locales as readonly string[]).includes(a.locale))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));
}

// GEO：把「能被 AI 引擎直接摘取并引用」的站点事实写成固定段落，
// llms.txt 与 llms-full.txt 共用，避免两处口径漂移。
const SITE_FACTS = `- 名称：starteday（八语种统一，不翻译）；规范域：${SITE_URL}
- 内容：每日 3 个原创话题；中文、英语、日语、韩语、西班牙语、法语、葡萄牙语、土耳其语各自独立撰写，不是机器翻译或摘要
- 原创性：正文保留可追溯的原始报道链接，但重写结构、补充背景与观点；文章页以 NewsArticle 结构化数据标注 citation / isBasedOn
- 配图：每篇 3 张 Wikimedia Commons 真实照片，许可为 CC BY / CC BY-SA / CC0 / 公有领域，文内逐张列出作者与许可；不使用 AI 生成图片
- 引用格式：starteday. (年份). 文章标题. starteday. ${SITE_URL}/<语种>/article/<文章 id>
- 使用许可：非商业引用与摘录欢迎，须注明来源与原文链接；整篇转载或商业使用请先联系编辑部
- 内容边界：选题避开政治、军事、宗教、种族与儿童相关议题
- 纠错与授权：事实错误、署名遗漏或授权请求见各语种「关于与引用」页的联系与纠错一节`;

export function buildNewsSitemap(): string {
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const recent = validArticles()
    .filter((a) => Number(a.publishedAt || 0) >= cutoff)
    .slice(0, MAX_URLS);

  const urls = recent
    .map((a) => {
      const loc = articleUrl(a);
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
  const latest = validArticles()
    .slice(0, 30)
    .map((a) => `- [${flat(a.title)}](${articleUrl(a)}): ${flat(a.summary || "").slice(0, 110)}`)
    .join("\n");

  return `# ${SITE_NAME}

> starteday 是一个覆盖中文、英语、日语、韩语、西班牙语、法语、葡萄牙语、土耳其语的原创科技与科学资讯站。所有文章为独立撰写的原创稿件，配图来自 Wikimedia Commons 并在文内标注作者与许可。

## 站点事实（可直接引用）

${SITE_FACTS}

## 语言入口

${homeLinks}

## 关于与引用规范

引用、转载或用于研究时，请先阅读各语种的关于页：其中给出规范引用格式、图片许可与署名政策、纠错渠道，是稳定的可引用入口。

${locales.map((l) => `- [${l} 关于与引用](${SITE_URL}/${l}/about)`).join("\n")}

## 机器可读入口

- [llms.txt 全量文章索引](${SITE_URL}/llms-full.txt)
- [humans.txt](${SITE_URL}/humans.txt)
- [RSS](${SITE_URL}/rss.xml)
- [Atom](${SITE_URL}/atom.xml)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Google News Sitemap](${SITE_URL}/news-sitemap.xml)

## 最新文章

${latest}
`;
}

// llms-full.txt（llmstxt.org 约定）：全量文章的纯文本索引，供 AI 搜索 / 语言模型
// 建立可引用索引。按语种分组，每行给出标题、绝对链接、发布日期、栏目与摘要。
export function buildLlmsFullTxt(): string {
  const all = validArticles();
  const groups = locales
    .map((l) => {
      const rows = all.filter((a) => a.locale === l);
      const lines = rows
        .map((a) => {
          const ts = Number(a.publishedAt || 0);
          const date = Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString().slice(0, 10) : "";
          const bits = [date, a.category, flat(a.summary || "")].filter(Boolean);
          return `- [${flat(a.title)}](${articleUrl(a)})${bits.length ? ` — ${bits.join(" · ")}` : ""}`;
        })
        .join("\n");
      return `### ${l}（${rows.length} 篇）\n\n${lines || "- （暂无文章）"}`;
    })
    .join("\n\n");

  return `# ${SITE_NAME} — 全量文章索引（llms-full.txt）

> 本文件是 ${SITE_URL}/llms.txt 的完整版，列出全部 ${all.length} 篇原创文章的标题、绝对链接、发布日期、栏目与摘要，供 AI 搜索与语言模型建立可引用索引。正文与图片署名以文章页为准；图片各自遵循其 Commons 原始 CC 许可。规范引用格式见 ${SITE_URL}/<语种>/about。

## 站点事实（可直接引用）

${SITE_FACTS}

## 全部文章（${all.length} 篇）

${groups}
`;
}
