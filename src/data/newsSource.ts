import { Locale, Category, categories } from "@/i18n/config";
import { Article } from "@/data/news";
import * as mock from "@/data/news";
import { rankRelated } from "@/lib/related";
import { getRealVideos, findVideo } from "@/data/videoSource";
import { getRssHomeFeed, findRssArticle, getRssArticles, getOriginalArticles, RSS_ENABLED } from "@/data/rssSource";
import { getDb, getArticleRow, queryArticles, DbArticle } from "@/lib/db";

// 数据源适配层：默认走内置 mock（无需 key 即可跑），
// 设了 NEWS_API_KEY 环境变量则自动切到 NewsAPI（多语言 + 分类映射 + 服务端缓存 + 失败回退 mock）。
export interface NewsSource {
  readonly name: string;
  getArticles(locale: Locale, category?: Category): Promise<Article[]>;
  getArticle(locale: Locale, id: string): Promise<Article | undefined>;
  getTrending(locale: Locale, n?: number): Promise<Article[]>;
  getRelated(locale: Locale, article: Article, n?: number): Promise<Article[]>;
}

// ---------- Mock 实现（默认）----------
class MockNewsSource implements NewsSource {
  readonly name = "mock";
  async getArticles(locale: Locale, category?: Category) {
    return mock.getArticles(locale, category);
  }
  async getArticle(locale: Locale, id: string) {
    return mock.getArticle(locale, id);
  }
  async getTrending(locale: Locale, n = 10) {
    return mock.getTrending(locale, n);
  }
  async getRelated(locale: Locale, article: Article, n = 6) {
    // 由"同分类取前 N"改为相似度精排（关键词 IDF + 标签 + 来源 + 分类 + 时效 + 同来源降重）
    return rankRelated(article, mock.getArticles(locale), n);
  }
}

// ---------- NewsAPI 实现（可选）----------
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// NewsAPI top-headlines 支持的语言（ja/ko 不在其列，回退 mock）
const NEWS_LANG: Partial<Record<Locale, string>> = {
  zh: "zh",
  en: "en",
  es: "es",
  fr: "fr",
};

// 站点分类 → NewsAPI 分类
const NEWS_CAT: Partial<Record<Category, string>> = {
  world: "general",
  tech: "technology",
  finance: "business",
  sports: "sports",
  entertainment: "entertainment",
  health: "health",
  science: "science",
};

function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

class NewsApiSource implements NewsSource {
  readonly name = "NewsAPI";
  private byId = new Map<string, Article>();
  private cache = new Map<string, { ts: number; items: Article[] }>();
  private ttl = 10 * 60 * 1000; // 10 分钟服务端缓存，避免超配额

  private async fetch(locale: Locale, category?: Category): Promise<Article[]> {
    const key = `${locale}:${category ?? "all"}`;
    const c = this.cache.get(key);
    if (c && Date.now() - c.ts < this.ttl) return c.items;
    const items = await this.fetchFromApi(locale, category);
    this.cache.set(key, { ts: Date.now(), items });
    for (const a of items) this.byId.set(a.id, a);
    return items;
  }

  private async fetchFromApi(locale: Locale, category?: Category): Promise<Article[]> {
    const apiLang = NEWS_LANG[locale];
    // 不支持的语言（ja/ko）或显式 video 分类（NewsAPI 无视频）→ 回退 mock
    if (!apiLang || category === "video") return mock.getArticles(locale, category);

    const params = new URLSearchParams({ language: apiLang, pageSize: "30" });
    const cat =
      category && category !== "recommend" ? NEWS_CAT[category] : undefined;
    if (cat) params.set("category", cat);

    const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": NEWS_API_KEY || "" },
        next: { revalidate: 600 },
      });
      if (!res.ok) return mock.getArticles(locale, category);
      const data = (await res.json()) as { articles?: any[] };
      const arts: Article[] = (data.articles || []).map((a) => this.toArticle(a, locale, category));
      return arts.length ? arts : mock.getArticles(locale, category);
    } catch {
      return mock.getArticles(locale, category);
    }
  }

  private toArticle(a: any, locale: Locale, category?: Category): Article {
    const url: string = a.url || "";
    const id = `news-${hashStr(url || a.title || String(Math.random()))}`;
    const publishedAt = a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now();
    const cat: Category =
      category && category !== "recommend" && category !== "video" ? category : "world";
    const poster: string = a.urlToImage || `https://picsum.photos/seed/${id}/600/400`;
    const desc: string = a.description || "";
    const body = [desc, a.content || "", `来源：${a.source?.name || "NewsAPI"}。`].filter(Boolean);
    return {
      id,
      locale,
      category: cat,
      title: a.title || "Untitled",
      summary: desc,
      body: body.length ? body : ["暂无正文。"],
      source: a.source?.name || "NewsAPI",
      author: a.source?.name || "NewsAPI",
      publishedAt,
      imageCount: 1,
      images: [poster],
      tags: (a.title || "").split(" ").slice(0, 3),
      readMinutes: 2,
    };
  }

  async getArticles(locale: Locale, category?: Category) {
    if (category === "video") return [];
    return this.fetch(locale, category);
  }
  async getArticle(locale: Locale, id: string) {
    if (this.byId.has(id)) return this.byId.get(id);
    await this.fetch(locale, "recommend");
    return this.byId.get(id);
  }
  async getTrending(locale: Locale, n = 10) {
    const items = await this.fetch(locale, "recommend");
    return items.slice(0, n);
  }
  async getRelated(locale: Locale, article: Article, n = 6) {
    const items = await this.fetch(locale, article.category);
    return items.filter((a) => a.id !== article.id).slice(0, n);
  }
}

let _source: NewsSource | null = null;

export function getNewsSource(): NewsSource {
  if (_source) return _source;
  _source = NEWS_API_KEY ? new NewsApiSource() : new MockNewsSource();
  return _source;
}

export function getSourceName(): string {
  return getNewsSource().name;
}

// 顶层便捷函数：自动走当前数据源（mock / NewsAPI / RSS 聚合）。
// 模块级 TTL 缓存：force-dynamic 下每个请求都会重跑本函数（RSS 合并 + 原创/用户稿件注入 + 视频交织），
// 加一层按 (locale,category) 的短时效缓存，避免相同请求在 TTL 内重复做这份纯计算，缩短首字节时间。
const _articlesCache = new Map<string, { ts: number; items: Article[] }>();
const ARTICLES_TTL = 10 * 60_000; // 10 分钟（cov35：拉长，首页/信息流纯计算更久复用）

// cov35：相关推荐按文章 id 缓存。rankRelated 的语料分词（16MB 词典 × 数百篇文章）
// 在「每 locale 首次」文章页冷渲染时约耗 50s；结果按 id 缓存 30min，
// 使同一文章页的重复访问（含被 nginx/CDN 回源）零计算，也避免不同文章反复触发冷构建。
const _relatedCache = new Map<string, { ts: number; items: Article[] }>();
const RELATED_TTL = 30 * 60_000;

export async function getArticles(locale: Locale, category?: Category): Promise<Article[]> {
  const key = `${locale}:${category ?? "all"}`;
  const hit = _articlesCache.get(key);
  if (hit && Date.now() - hit.ts < ARTICLES_TTL) return hit.items;
  const items = await getArticlesInner(locale, category);
  _articlesCache.set(key, { ts: Date.now(), items });
  return items;
}

async function getArticlesInner(locale: Locale, category?: Category): Promise<Article[]> {
  // 视频分类：统一走真实视频源（YouTube+Bilibili，密钥仅服务端、构建时拉取）
  if (category === "video") return getRealVideos(locale);

  // 注入「原创策展文章」（data/original 合并进 articles.json，id 形如 rss-orig-*），
  // 使各分类板块（含 zh 无 RSS 源的 sports/health 等）都有原创内容，且能被预渲染。
  const injectOriginals = (list: Article[]): Article[] => {
    const extras = getOriginalArticles(locale, category);
    if (!extras.length) return list;
    const ids = new Set(list.map((a) => a.id));
    const out = list.slice();
    for (const o of extras) if (!ids.has(o.id)) { out.push(o); ids.add(o.id); }
    return out;
  };

  // RSS 聚合（构建时拉取真实媒体资讯，无 key 时优先；设了 NEWS_API_KEY 则让位 NewsAPI）
  if (!category && RSS_ENABLED && !process.env.NEWS_API_KEY) {
    try {
      const feed = await getRssHomeFeed(locale);
      if (feed) {
        if (process.env.NODE_ENV === "production") {
          console.log(`[rss] ${locale}: 真实 RSS 聚合生效，共 ${feed.length} 条`);
        }
        const videos = await getRealVideos(locale);
        return mergeVideos(injectUserArticles(injectOriginals(feed), locale), videos);
      }
    } catch {
      // 落到下方 mock
    }
  }

  const base = await getNewsSource().getArticles(locale, category);
  if (category) return injectUserArticles(injectOriginals(base), locale, category); // 指定非视频分类：不混入视频，但注入原创 + 用户稿件

  // 首页「推荐」流：把真实视频交织进新闻流（视频 tab 也靠这一份过滤）
  const videos = await getRealVideos(locale);
  return mergeVideos(injectUserArticles(injectOriginals(base), locale), videos);
}

// DB 文章行 -> 前端 Article（用户稿件桥接）
function dbArticleToArticle(a: DbArticle): Article {
  const images = JSON.parse(a.images || "[]") as string[];
  const tags = JSON.parse(a.tags || "[]") as string[];
  const summary = a.summary || "";
  const body = summary
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: a.id,
    locale: a.locale as Locale,
    category: a.category as Category,
    title: a.title,
    summary,
    body: body.length ? body : [summary || "暂无正文。"],
    source: a.source || "用户投稿",
    author: a.author || "用户投稿",
    publishedAt: a.published_at,
    imageCount: (images.length >= 3 ? 3 : 1) as 1 | 3,
    images: images.length ? images : ["/img/earth-night.jpg"],
    cover: a.cover || undefined,
    tags,
    readMinutes: a.read_minutes || 2,
    sourceUrl: a.source_url || undefined,
    media: a.media === "video" ? "video" : undefined,
    videoPlatform: (a.video_platform as "youtube" | "bilibili") || undefined,
    videoId: a.video_id || undefined,
  };
}

// 注入用户发布的稿件（DB）进公共信息流；DB 不可用（构建期）时静默跳过
function injectUserArticles(list: Article[], locale: Locale, category?: Category): Article[] {
  try {
    const db = getDb();
    const rows = queryArticles(db, { locale, category, includeDrafts: false, limit: 20 });
    const mine = rows
      .filter((r) => (r as { owner_id?: number | null }).owner_id != null)
      .map(dbArticleToArticle);
    if (!mine.length) return list;
    const ids = new Set(list.map((a) => a.id));
    const extras = mine.filter((a) => !ids.has(a.id));
    return extras.concat(list);
  } catch {
    return list;
  }
}

// 新闻流每 ~8 条插 1 条视频，视频不足时补在末尾
function mergeVideos(news: Article[], videos: Article[]): Article[] {
  const newsOnly = news.filter((a) => a.category !== "video");
  const out: Article[] = [];
  let vi = 0;
  for (let i = 0; i < newsOnly.length || vi < videos.length; i++) {
    if (i < newsOnly.length) out.push(newsOnly[i]);
    if (vi < videos.length && (i % 8 === 7 || i >= newsOnly.length)) {
      out.push(videos[vi++]);
    }
  }
  return out;
}

export async function getArticle(locale: Locale, id: string): Promise<Article | undefined> {
  const fromSource = await getNewsSource().getArticle(locale, id);
  if (fromSource) return fromSource;
  // 兜底 RSS 真实采集文章（id 形如 rss-<hash>）。
  // 注意：Next 的 generateStaticParams 与页面渲染可能在不同 worker，模块缓存不共享，
  // 因此首次按 id 查找时先预热该语言 RSS 缓存（带缓存，仅首次联网）。
  if (!process.env.NEWS_API_KEY && RSS_ENABLED) {
    if (id.startsWith("rss-")) await getRssHomeFeed(locale);
    const r = findRssArticle(id);
    if (r) return r;
  }
  // 兜底真实视频（id 形如 video-<ytId> / video-<bvid>）
  if (id.startsWith("video-")) return findVideo(locale, id);
  // 兜底用户稿件（DB，id 形如 u<base36>...）：发布后文章页可直接访问
  if (id.startsWith("u")) {
    try {
      const db = getDb();
      const row = getArticleRow(db, id) as (DbArticle & { deleted?: number }) | undefined;
      if (row && !row.deleted && row.locale === locale) return dbArticleToArticle(row);
    } catch {
      /* 构建期无 DB 时忽略 */
    }
  }
  return undefined;
}
export function getTrending(locale: Locale, n = 10): Promise<Article[]> {
  return getNewsSource().getTrending(locale, n);
}

// 相关推荐：真实 RSS 文章优先推荐同语言、同分类（不足再跨分类）的真实采集文章，
// 用「标题关键词(词典分词+IDF) + 标签 + 来源 + 分类 + 时效」相似度精排，并做同来源降重；
// 非 RSS / RSS 拉取失败则回退当前数据源（mock / NewsAPI，同样走相似度精排）。
export async function getRelated(locale: Locale, article: Article, n = 6): Promise<Article[]> {
  const rkey = `${locale}:${article.id}:${n}`;
  const rhit = _relatedCache.get(rkey);
  if (rhit && Date.now() - rhit.ts < RELATED_TTL) return rhit.items;
  let result: Article[] | null = null;
  if (!process.env.NEWS_API_KEY && RSS_ENABLED && article.id.startsWith("rss-")) {
    try {
      const rssCat = article.category as Exclude<Category, "recommend" | "video">;
      let pool = await getRssArticles(locale, rssCat);
      if (pool.length < 200) {
        const others = categories.filter(
          (c) => c !== "video" && c !== "recommend" && c !== article.category
        ) as Exclude<Category, "recommend" | "video">[];
        for (const c of others) {
          pool = pool.concat(await getRssArticles(locale, c));
          if (pool.length >= 200) break;
        }
      }
      const rel = pool.filter((a) => a.id !== article.id);
      if (rel.length) {
        // 相似度精排（RSS 的 tag 多等于标题，按标签重合排序等于没排，故改用内容相似度）
        result = rankRelated(article, rel, n);
      }
    } catch {
      /* 落到下方回退 */
    }
  }
  if (!result) result = await getNewsSource().getRelated(locale, article, n);
  _relatedCache.set(rkey, { ts: Date.now(), items: result });
  return result;
}
