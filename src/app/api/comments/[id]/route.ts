import { NextRequest, NextResponse } from "next/server";
import { getDb, deleteCommentById } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/comments/[id] -> 删除自己的评论（管理员可删任意）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) return NextResponse.json({ error: "id 不合法" }, { status: 400 });
  const db = getDb();
  const row = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(cid) as
    | { user_id: number | null }
    | undefined;
  if (!row) return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  if (row.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "无权删除此评论" }, { status: 403 });
  }
  deleteCommentById(db, cid);
  return NextResponse.json({ ok: true });
}
