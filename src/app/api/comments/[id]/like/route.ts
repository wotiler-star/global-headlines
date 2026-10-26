import { NextRequest, NextResponse } from "next/server";
import { getDb, toggleCommentLike } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/comments/[id]/like -> 登录用户点赞/取消赞（toggle），返回最新计数
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录后再点赞" }, { status: 401 });
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) return NextResponse.json({ error: "id 不合法" }, { status: 400 });
  const db = getDb();
  const exists = db.prepare("SELECT id FROM comments WHERE id = ?").get(cid);
  if (!exists) return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  const r = toggleCommentLike(db, user.id, cid);
  return NextResponse.json({ ok: true, liked: r.liked, count: r.count });
}
