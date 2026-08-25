import { Locale, Category, categories } from "@/i18n/config";
import { Article } from "@/data/news";
import * as mock from "@/data/news";
import { getRealVideos, findVideo } from "@/data/videoSource";
import { getRssHomeFeed, findRssArticle, getRssArticles, RSS_ENABLED } from "@/data/rssSource";

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
    return mock.getRelated(locale, article, n);
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

// 顶层便捷函数：自动走当前数据源（mock / NewsAPI / RSS 聚合）
export async function getArticles(locale: Locale, category?: Category): Promise<Article[]> {
  // 视频分类：统一走真实视频源（YouTube+Bilibili，密钥仅服务端、构建时拉取）
  if (category === "video") return getRealVideos(locale);

  // RSS 聚合（构建时拉取真实媒体资讯，无 key 时优先；设了 NEWS_API_KEY 则让位 NewsAPI）
  if (!category && RSS_ENABLED && !process.env.NEWS_API_KEY) {
    try {
      const feed = await getRssHomeFeed(locale);
      if (feed) {
        if (process.env.NODE_ENV === "production") {
          console.log(`[rss] ${locale}: 真实 RSS 聚合生效，共 ${feed.length} 条`);
        }
        const videos = await getRealVideos(locale);
        return mergeVideos(feed, videos);
      }
    } catch {
      // 落到下方 mock
    }
  }

  const base = await getNewsSource().getArticles(locale, category);
  if (category) return base; // 指定非视频分类：不混入视频

  // 首页「推荐」流：把真实视频交织进新闻流（视频 tab 也靠这一份过滤）
  const videos = await getRealVideos(locale);
  return mergeVideos(base, videos);
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
  return undefined;
}
export function getTrending(locale: Locale, n = 10): Promise<Article[]> {
  return getNewsSource().getTrending(locale, n);
}

// 相关推荐：真实 RSS 文章优先推荐同语言、同分类（不足再跨分类）的真实采集文章，
// 按标签重合度排序；非 RSS / RSS 拉取失败则回退当前数据源（mock / NewsAPI）。
export async function getRelated(locale: Locale, article: Article, n = 6): Promise<Article[]> {
  if (!process.env.NEWS_API_KEY && RSS_ENABLED && article.id.startsWith("rss-")) {
    try {
      const rssCat = article.category as Exclude<Category, "recommend" | "video">;
      let pool = await getRssArticles(locale, rssCat);
      if (pool.length < n) {
        const others = categories.filter(
          (c) => c !== "video" && c !== "recommend" && c !== article.category
        ) as Exclude<Category, "recommend" | "video">[];
        for (const c of others) {
          pool = pool.concat(await getRssArticles(locale, c));
          if (pool.length >= n * 2) break;
        }
      }
      const rel = pool.filter((a) => a.id !== article.id);
      if (rel.length) {
        const tagset = new Set(article.tags.map((t) => t.toLowerCase()));
        const score = (a: Article) =>
          a.tags.reduce((s, t) => (tagset.has(t.toLowerCase()) ? s + 1 : s), 0);
        return [...rel].sort((a, b) => score(b) - score(a)).slice(0, n);
      }
    } catch {
      /* 落到下方回退 */
    }
  }
  return getNewsSource().getRelated(locale, article, n);
}
