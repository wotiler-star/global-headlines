import { NextRequest, NextResponse } from "next/server";
import { getDb, getBookmarks, setBookmark, getArticleRow, recordUserEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/bookmarks -> 当前登录用户的收藏列表
export async function GET() {
  const user = await getCurrentUser();
  // 匿名访问：未登录即无收藏，返回空数组而非 401（登录态由 localStorage 兜底）
  if (!user) return NextResponse.json({ bookmarks: [] });
  const db = getDb();
  return NextResponse.json({ bookmarks: getBookmarks(db, user.id) });
}

// POST /api/bookmarks { articleId, on } -> 切换收藏状态
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const articleId = String(body?.articleId ?? "").trim();
  const on = Boolean(body?.on);
  const clientCat = body?.category ? String(body.category).slice(0, 32) : null;
  if (!articleId) {
    return NextResponse.json({ error: "articleId 必填" }, { status: 400 });
  }
  const db = getDb();
  setBookmark(db, user.id, articleId, on);
  if (on) {
    const cat = clientCat || getArticleRow(db, articleId)?.category || null;
    if (cat) recordUserEvent(db, user.id, "bookmark", cat, 3, articleId);
  }
  return NextResponse.json({ ok: true, bookmarks: getBookmarks(db, user.id) });
}
