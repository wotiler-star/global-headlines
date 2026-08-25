import { NextRequest, NextResponse } from "next/server";
import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { isLocale, isCategory } from "@/i18n/config";

export const dynamic = "force-dynamic";

function serialize(a: DbArticle) {
  return {
    id: a.id,
    locale: a.locale,
    category: a.category,
    title: a.title,
    summary: a.summary,
    source: a.source,
    author: a.author,
    publishedAt: a.published_at,
    imageCount: a.image_count,
    images: JSON.parse(a.images || "[]"),
    tags: JSON.parse(a.tags || "[]"),
    readMinutes: a.read_minutes,
    media: a.media,
    videoPlatform: a.video_platform,
    videoId: a.video_id,
    sourceUrl: a.source_url,
  };
}

// GET /api/articles?locale=zh&category=tech&q=...&tag=...&limit=30&offset=0
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const localeParam = sp.get("locale") || "";
  const categoryParam = sp.get("category") || "";
  const q = sp.get("q") || undefined;
  const tag = sp.get("tag") || undefined;
  const limit = Math.min(Number(sp.get("limit") || 30) || 30, 100);
  const offset = Number(sp.get("offset") || 0) || 0;

  const db = getDb();
  const rows = queryArticles(db, {
    locale: isLocale(localeParam) ? localeParam : undefined,
    category: isCategory(categoryParam) ? categoryParam : undefined,
    q,
    tag,
    limit,
    offset,
  });
  return NextResponse.json({ articles: rows.map(serialize), nextOffset: offset + rows.length });
}
