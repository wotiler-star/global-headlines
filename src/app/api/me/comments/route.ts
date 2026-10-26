import { NextResponse } from "next/server";
import { getDb, getCommentsByUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/me/comments -> 当前用户的评论列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const db = getDb();
  return NextResponse.json({ items: getCommentsByUser(db, user.id, 50) });
}
