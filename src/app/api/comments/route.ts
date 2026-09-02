import { NextRequest, NextResponse } from "next/server";
import { getDb, getComments, addComment, CommentRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function serialize(c: CommentRow) {
  return {
    id: c.id,
    articleId: c.article_id,
    userId: c.user_id,
    authorName: c.author_name,
    body: c.body,
    createdAt: c.created_at,
  };
}

// GET /api/comments?articleId=xxx -> 某文章评论列表
export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId 必填" }, { status: 400 });
  }
  const db = getDb();
  return NextResponse.json({ comments: getComments(db, articleId).map(serialize) });
}

// POST /api/comments { articleId, body, authorName? } -> 发表评论
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const articleId = String(body?.articleId ?? "").trim();
  const text = String(body?.body ?? "").trim();
  if (!articleId || !text) {
    return NextResponse.json({ error: "articleId 和 body 必填" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "评论过长（上限 1000 字）" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (user && user.banned === 1) {
    return NextResponse.json({ error: "账号已被禁言" }, { status: 403 });
  }
  let authorName = String(body?.authorName ?? "").trim();
  if (user) {
    authorName = authorName || user.username;
  } else {
    authorName = authorName || "游客";
  }
  const db = getDb();
  const row = addComment(db, articleId, authorName, text, user ? user.id : null);
  return NextResponse.json({ ok: true, comment: serialize(row) }, { status: 201 });
}
