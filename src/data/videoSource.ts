import { Locale } from "@/i18n/config";
import { Article } from "@/data/news";
import * as mock from "@/data/news";

// ---------------------------------------------------------------------------
// 真实视频源（YouTube Data API + Bilibili）
//
// 关键设计：静态导出（output: "export"）下，唯一的服务端取数机会是 `next build`
// 阶段。因此这里在构建时拉取真实视频，密钥（YOUTUBE_API_KEY / BILIBILI_COOKIE）
// 仅在服务端读取，绝不进入浏览器包。渲染层按 Article.videoPlatform+videoId 嵌入。
//
// - 不设 YOUTUBE_API_KEY：回退到 news.ts 内置的公开示例 ID（维持原行为）。
// - 设了 key 但拉取失败：同样回退示例，保证构建不崩、视频 tab 不为空。
// ---------------------------------------------------------------------------

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BILIBILI_COOKIE = process.env.BILIBILI_COOKIE; // 可选，提升 B 站命中率

// 各语言的检索词（用该语言，保证标题/描述本地化）
const VIDEO_QUERY: Record<Locale, string> = {
  zh: "科技 自然 太空 纪录片",
  en: "technology nature space documentary",
  ja: "テクノロジー 自然 宇宙 ドキュメンタリー",
  ko: "기술 자연 우주 다큐멘터리",
  es: "tecnología naturaleza espacio documental",
  fr: "technologie nature espace documentaire",
};

// YouTube 检索语言（relevanceLanguage）
const YT_LANG: Partial<Record<Locale, string>> = {
  zh: "zh",
  en: "en",
  ja: "ja",
  ko: "ko",
  es: "es",
  fr: "fr",
};

const TTL = 10 * 60 * 1000; // 构建期内缓存，避免重复消耗配额
const cache = new Map<Locale, { ts: number; items: Article[] }>();

export function hasVideoApi(): boolean {
  return !!YOUTUBE_API_KEY;
}

function parseIsoDuration(s?: string): number | undefined {
  if (!s) return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s);
  if (!m) return undefined;
  return (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// ---------- YouTube ----------
function ytToArticle(v: any, locale: Locale): Article | null {
  const id = v?.id?.videoId || v?.id;
  if (!id) return null;
  const sn = v?.snippet || {};
  const title: string = sn.title || "Video";
  const desc: string = sn.description || "";
  const thumb: string =
    sn.thumbnails?.maxres?.url ||
    sn.thumbnails?.high?.url ||
    sn.thumbnails?.medium?.url ||
    sn.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const publishedAt = sn.publishedAt ? new Date(sn.publishedAt).getTime() : Date.now();
  const channel: string = sn.channelTitle || "YouTube";
  const dur = parseIsoDuration(v?.contentDetails?.duration);
  return {
    id: `video-${id}`,
    locale,
    category: "video",
    title,
    summary: desc.slice(0, 220),
    body: [desc || title, `来源：${channel}（YouTube）。`],
    source: channel,
    author: channel,
    publishedAt,
    imageCount: 1,
    images: [thumb],
    tags: title.split(/\s+/).slice(0, 4),
    readMinutes: Math.max(2, Math.round((dur || 180) / 60)),
    media: "video",
    videoPlatform: "youtube",
    videoId: id,
  };
}

async function fetchYoutube(query: string, locale: Locale, n: number): Promise<Article[]> {
  if (!YOUTUBE_API_KEY) return [];
  try {
    const rel = YT_LANG[locale];
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&maxResults=${n}&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}` +
      `${rel ? `&relevanceLanguage=${rel}` : ""}`;
    const sres = await fetch(searchUrl);
    if (!sres.ok) return [];
    const sdata = (await sres.json()) as { items?: any[] };
    const sItems = sdata.items || [];
    if (!sItems.length) return [];

    // 用 videos 接口补 duration / 更稳的缩略图（搜索接口已含 snippet）
    const ids = sItems.map((i) => i.id?.videoId).filter(Boolean).join(",");
    let detailItems = sItems;
    try {
      const dres = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids}&key=${YOUTUBE_API_KEY}`
      );
      if (dres.ok) {
        const ddata = (await dres.json()) as { items?: any[] };
        if (ddata.items?.length) detailItems = ddata.items;
      }
    } catch {
      /* 忽略：用搜索结果兜底 */
    }
    return detailItems
      .map((i) => ytToArticle(i, locale))
      .filter((a): a is Article => a !== null);
  } catch {
    return [];
  }
}

// ---------- Bilibili（best-effort）----------
function biliToArticle(v: any, locale: Locale): Article | null {
  const bvid: string = v?.bvid;
  if (!bvid) return null;
  const title: string = v?.title ? stripHtml(v.title) : "Bilibili 视频";
  const desc: string = v?.description || "";
  const pic: string = v?.pic
    ? v.pic.startsWith("http")
      ? v.pic
      : `https:${v.pic}`
    : `https://api.bilibili.com/x/web-show/res/small/av${v.aid}.jpg`;
  const author: string = v?.author || "Bilibili";
  const publishedAt = v?.pubdate ? v.pubdate * 1000 : Date.now();
  const dur: number = v?.duration || 0;
  return {
    id: `video-${bvid}`,
    locale,
    category: "video",
    title,
    summary: desc.slice(0, 220),
    body: [desc || title, `来源：${author}（Bilibili）。`],
    source: author,
    author,
    publishedAt,
    imageCount: 1,
    images: [pic],
    tags: [title],
    readMinutes: Math.max(2, Math.round((dur || 180) / 60)),
    media: "video",
    videoPlatform: "bilibili",
    videoId: bvid,
  };
}

async function fetchBilibili(query: string, locale: Locale, n: number): Promise<Article[]> {
  try {
    const url = `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://search.bilibili.com",
        ...(BILIBILI_COOKIE ? { Cookie: BILIBILI_COOKIE } : {}),
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const groups: any[] = data?.data?.result || [];
    const videoGroup = groups.find((g) => g.result_type === "video");
    const vids: any[] = videoGroup?.data || [];
    return vids
      .slice(0, n)
      .map((v) => biliToArticle(v, locale))
      .filter((a): a is Article => a !== null);
  } catch {
    // B 站接口常因风控/无 cookie 失败，静默跳过，由 YouTube 补位
    return [];
  }
}

function interleave(a: Article[], b: Article[]): Article[] {
  const out: Article[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/**
 * 取某语言的真实视频列表（YouTube + Bilibili 交织）。
 * 无 key / 拉取失败 → 回退 news.ts 内置示例 ID，保证视频 tab 永不为空。
 */
export async function getRealVideos(locale: Locale): Promise<Article[]> {
  const cached = cache.get(locale);
  if (cached && Date.now() - cached.ts < TTL) return cached.items;

  const query = VIDEO_QUERY[locale] || VIDEO_QUERY.en;
  const [yt, bili] = await Promise.all([
    fetchYoutube(query, locale, 10),
    BILIBILI_COOKIE ? fetchBilibili(query, locale, 10) : Promise.resolve([]),
  ]);

  let items: Article[] = interleave(yt, bili);
  if (items.length === 0) {
    // 回退：内置公开示例（维持无 key 时的原行为）
    items = mock.getArticles(locale, "video");
  }
  cache.set(locale, { ts: Date.now(), items });
  return items;
}

/** 按 id 查找真实视频（供 getArticle 兜底）。 */
export async function findVideo(locale: Locale, id: string): Promise<Article | undefined> {
  const cached = cache.get(locale);
  if (cached) {
    const found = cached.items.find((a) => a.id === id);
    if (found) return found;
  }
  const items = await getRealVideos(locale);
  return items.find((a) => a.id === id);
}
