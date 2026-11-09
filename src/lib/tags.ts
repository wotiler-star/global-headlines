import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import type { Article } from "@/data/news";

// 标签落地页索引（服务端/构建期专用）。
//
// 内链优化：文章标签原本指向 /<locale>?tag=<x>（首页客户端筛选参数），canonical 归首页，
// 既不是可索引入口，也无法把权重传给「同主题聚合页」。现改为静态 /<locale>/tag/<slug>。
//
// 防爆策略：tag 是自由文本（RSS 的 tag 常直接等于标题），全量建页会产生上千个
// 「仅 1 篇文章」的 thin content 页。故 sitemap / generateStaticParams 只收录
// 「关联文章数 >= TAG_MIN_ARTICLES 且按文章数降序前 TAG_MAX_PER_LOCALE」的优质标签；
// 其余标签页仍可访问（dynamicParams=true）但标记 noindex，保证文章 chip 零死链。
//
// 一致性关键：slug 冲突消歧依赖稳定的构建顺序，故 slug 必须**只从全量索引计算一次**，
// 优质子集由同一份索引派生（不能各自重算，否则同一 tag 可能得到不同 slug → 死链）。

export const TAG_MIN_ARTICLES = 3;
export const TAG_MAX_PER_LOCALE = 40;
export const TAG_INDEX_CAP = 200;

export type TagEntry = { slug: string; tag: string; articles: Article[] };

/** 任意 tag 文本 → URL 安全 slug（保留各语种字母/数字，空白转连字符，剔除标点）。 */
export function tagToSlug(tag: string): string {
  const s = tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^-\p{L}\p{N}]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "tag";
}

// slug 冲突时用的稳定短哈希（FNV-1a），保证构建期与运行期结果一致。
function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5);
}

/**
 * 从某语种全量文章流构建完整标签索引（所有 tag，含只有 1 篇的）。
 * 按 tag 小写归一；同一文章在同一 tag 下只计一次；按关联文章数降序、名称升序稳定排序。
 * 排序稳定 ⇒ 同一份数据在任何 worker 都得到完全相同的 slug 集合。
 */
export function buildTagIndex(articles: Article[]): TagEntry[] {
  const byKey = new Map<string, { tag: string; list: Article[] }>();
  for (const a of articles) {
    for (const raw of a.tags || []) {
      const tag = (raw || "").trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      let hit = byKey.get(key);
      if (!hit) {
        hit = { tag, list: [] };
        byKey.set(key, hit);
      }
      if (!hit.list.some((x) => x.id === a.id)) hit.list.push(a);
    }
  }

  const sorted = [...byKey.values()]
    .sort((a, b) => b.list.length - a.list.length || a.tag.localeCompare(b.tag))
    .slice(0, TAG_INDEX_CAP);

  const used = new Set<string>();
  return sorted.map((e) => {
    let slug = tagToSlug(e.tag);
    if (used.has(slug)) slug = `${slug}-${shortHash(e.tag.toLowerCase())}`;
    used.add(slug);
    return {
      slug,
      tag: e.tag,
      articles: [...e.list].sort((x, y) => y.publishedAt - x.publishedAt),
    };
  });
}

/** 可进 sitemap / 预生成的优质标签（从同一份全量索引派生，slug 不会漂移）。 */
export function indexableTags(index: TagEntry[]): TagEntry[] {
  return index
    .filter((e) => e.articles.length >= TAG_MIN_ARTICLES)
    .slice(0, TAG_MAX_PER_LOCALE);
}

export function findTagEntry(index: TagEntry[], slug: string): TagEntry | undefined {
  return index.find((e) => e.slug === slug);
}

// ---------------------------------------------------------------------------
// 稳定标签数据源（cov63c 修复）：只读 data/original/*.json。
//
// 为什么不能用 getArticles()：标签索引要求 generateStaticParams、页面渲染、sitemap、
// 文章 chip 四处数据**完全一致**，否则会 prerender 出 404 页（sitemap 收录但线上 404）。
// 而 getArticles 的 RSS 部分在 build 期按 worker 联网拉取（data/articles.json 被
// .dockerignore 的 data/* 排除、不进镜像），params worker 与渲染 worker 各拉各的、
// 结果漂移 —— 实测导致 /zh/tag/消费电子 预渲染为 404。
// data/original/*.json 是 git 跟踪文件（.dockerignore 明确保留 data/original/），
// 进镜像、不联网，任何 worker 在任何阶段读到的都是同一份 → 零漂移、零死链。
// ---------------------------------------------------------------------------
const _tagSrcCache = new Map<string, Article[]>();

export function loadTagSourceArticles(locale: Locale): Article[] {
  const hit = _tagSrcCache.get(locale);
  if (hit) return hit;
  const out: Article[] = [];
  try {
    const dir = path.join(process.cwd(), "data", "original");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      let arr: unknown;
      try {
        arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        continue; // 单个文件损坏不影响整体
      }
      const list = Array.isArray(arr)
        ? arr
        : ((arr as { articles?: Article[] })?.articles ?? []);
      for (const a of list as Article[]) {
        if ((a?.locale || "zh") === locale && Array.isArray(a?.tags) && a.tags.length) {
          out.push(a);
        }
      }
    }
  } catch {
    // 目录不存在（极端环境）：返回空，标签页降级为空集而不是 500
  }
  _tagSrcCache.set(locale, out);
  return out;
}

export function tagHref(locale: Locale, slug: string): string {
  return `/${locale}/tag/${slug}`;
}

/**
 * 文章页用：tag 文本 → 静态页 href。
 * 只在「优质标签」集合里查找——与 generateStaticParams / sitemap 完全同一份判定，
 * 保证 chip 链接必然指向已预生成的静态页（零死链）；未命中回退 ?tag= 首页筛选。
 */
export function tagHrefIfIndexed(
  locale: Locale,
  tag: string,
  index: TagEntry[],
): string | null {
  const hit = indexableTags(index).find(
    (e) => e.tag.toLowerCase() === tag.trim().toLowerCase(),
  );
  return hit ? tagHref(locale, hit.slug) : null;
}
