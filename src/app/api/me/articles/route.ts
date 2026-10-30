import { NextResponse } from "next/server";
import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    tags: JSON.parse(a.tags || "[]"),
    status: (a as { status?: string }).status ?? "published",
    pinned: (a as { pinned?: number }).pinned ?? 0,
    deleted: (a as { deleted?: number }).deleted ?? 0,
    cover: (a as { cover?: string | null }).cover ?? null,
    reviewNote: (a as { review_note?: string | null }).review_note ?? null,
    body: a.body ?? null,
    wordCount: a.word_count ?? 0,
    submittedAt: a.submitted_at ?? null,
    updatedAt: a.updated_at ?? null,
  };
}

// GET /api/me/articles -> 当前用户的全部稿件（含草稿/已删）
export async function GET() {
  const user = await getCurrentUser();
  // 匿名访问：未登录即没有稿件（文章页用它判断是否是作者），返回空列表而非 401
  if (!user) return NextResponse.json({ items: [] });
  const db = getDb();
  const rows = queryArticles(db, {
    ownerId: user.id,
    includeDeleted: true,
    includeDrafts: true,
    limit: 100,
  });
  return NextResponse.json({ items: rows.map(serialize) });
}
