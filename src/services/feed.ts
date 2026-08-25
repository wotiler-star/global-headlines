// Feed service layer — mirrors a real news-site feed backend, but backed by the
// data-source adapter (mock / NewsAPI). Keeps the page components free of data
// plumbing so the architecture reads like a Toutiao-style front end (service →
// server component → interactive client feed).
import { Locale, Category, isCategory } from "@/i18n/config";
import { getArticles, getTrending } from "@/data/newsSource";
import { Article } from "@/data/news";

export interface FeedPage {
  items: Article[];
  nextPage: number | null;
  total: number;
  page: number;
}

export interface FeedQuery {
  page?: number;
  pageSize?: number;
  category?: Category;
  query?: string;
  exclude?: string[];
}

// Paginated, filterable feed. Pure in-memory slicing over the baked article list,
// so it works on a static export (no runtime DB needed).
export async function getFeed(
  locale: Locale,
  { page = 0, pageSize = 10, category, query, exclude = [] }: FeedQuery = {}
): Promise<FeedPage> {
  let all = await getArticles(locale);
  if (category && category !== "recommend") {
    all = all.filter((a) => a.category === category);
  }
  const q = query?.trim().toLowerCase();
  if (q) {
    all = all.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    );
  }
  if (exclude.length) {
    const ex = new Set(exclude);
    all = all.filter((a) => !ex.has(a.id));
  }
  const total = all.length;
  const start = page * pageSize;
  const items = all.slice(start, start + pageSize);
  const nextPage = start + pageSize < total ? page + 1 : null;
  return { items, nextPage, total, page };
}

// Hot board (热榜): a simple engagement score = recency decay + popularity +
// video boost. Computed at build time for the static export.
export async function getHotBoard(locale: Locale, limit = 10): Promise<Article[]> {
  const all = await getArticles(locale);
  const now = Date.now();
  const score = (a: Article) => {
    const ageHrs = (now - a.publishedAt) / 3_600_000;
    const recency = 1 / (1 + ageHrs / 12);
    const popularity = a.readMinutes * 0.5 + (a.media === "video" ? 3 : 0);
    return recency * 10 + popularity;
  };
  return [...all].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// Trending list for the rail (delegates to the source adapter's trending).
export async function getTrendingList(locale: Locale): Promise<Article[]> {
  return getTrending(locale);
}

// Validate an incoming category string against the known set.
export function asCategory(v: string | null): Category | null {
  return v && isCategory(v) ? v : null;
}
