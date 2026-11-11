// topics.ts — 主题实体档案页的数据层（构建期 / 服务端专用）。
//
// 为什么用「主题 slug」而不是 tag 做实体：tag 是各语种自由文本，实测 162 个中文标签
// 里只有 1 个关联 >=3 篇文章，做实体页会退化成几乎空集；而每批 3 个主题在 8 个语种
// 共用同一个拉丁 slug（china-webnovel-global 等），是天然稳定、可互链、可做完整
// hreflang 的实体载体。数据源与 lib/tags.ts 一致：只读 data/original/*.json，
// 保证 generateStaticParams / 页面渲染 / sitemap 三者零漂移。
import fs from "node:fs";
import path from "node:path";
import { locales, type Locale } from "@/i18n/config";

export type TopicArticle = {
  id: string;
  locale: string;
  title: string;
  summary?: string;
  category?: string;
  publishedAt?: number;
  sourceUrl?: string;
  cover?: string;
};

export type TopicEntry = {
  slug: string;
  batch: string;
  articles: Partial<Record<Locale, TopicArticle>>;
  count: number;
  publishedAt: number;
  category: string;
  sourceUrl?: string;
};

/** rss-orig-photonic-memristor-2026-11k-en → photonic-memristor */
export function topicSlug(id: string): string {
  return id
    .replace(/-(en|ja|ko|es|fr|pt|tr)$/, "")
    .replace(/^rss-orig-/, "")
    .replace(/-2026-11[a-z]?$/, "");
}

function topicBatch(id: string): string {
  const m = /-2026-11([a-z]?)(?:-[a-z]{2})?$/.exec(id);
  return m ? `2026-11${m[1]}` : "archive";
}

let _cache: TopicEntry[] | null = null;

/** 全量主题索引，按最新发布时间降序；同一 slug 聚合 8 个语种版本。 */
export function loadTopics(): TopicEntry[] {
  if (_cache) return _cache;
  const map = new Map<string, TopicEntry>();
  const dir = path.join(process.cwd(), "data", "original");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    _cache = [];
    return _cache;
  }
  for (const f of files) {
    let arr: unknown;
    try {
      arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const raw of arr as TopicArticle[]) {
      if (!raw || !raw.id || !raw.title) continue;
      const slug = topicSlug(raw.id);
      if (!slug) continue;
      const loc = (locales as readonly string[]).includes(raw.locale || "")
        ? (raw.locale as Locale)
        : "zh";
      let entry = map.get(slug);
      if (!entry) {
        entry = {
          slug,
          batch: topicBatch(raw.id),
          articles: {},
          count: 0,
          publishedAt: 0,
          category: raw.category || "tech",
        };
        map.set(slug, entry);
      }
      if (!entry.articles[loc]) {
        entry.articles[loc] = raw;
        entry.count += 1;
      }
      const ts = Number(raw.publishedAt || 0);
      if (ts > entry.publishedAt) entry.publishedAt = ts;
      if (raw.sourceUrl) entry.sourceUrl = raw.sourceUrl;
      if (raw.category) entry.category = raw.category;
    }
  }
  _cache = [...map.values()].sort(
    (a, b) => b.publishedAt - a.publishedAt || a.slug.localeCompare(b.slug),
  );
  return _cache;
}

export function findTopic(slug: string): TopicEntry | undefined {
  return loadTopics().find((t) => t.slug === slug);
}

export function topicHref(locale: Locale, slug: string): string {
  return `/${locale}/topic/${slug}`;
}
