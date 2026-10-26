import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, getArticleRow, getArticleOwner, updateUserArticle, setArticleDeleted } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// 稿件变动后失效文章页 + 对应语言首页的 ISR 缓存
function revalidateArticle(id: string) {
  const db = getDb();
  const row = getArticleRow(db, id);
  if (row) {
    revalidatePath(`/${row.locale}/article/${id}`);
    revalidatePath(`/${row.locale}`);
  }
}

export const dynamic = "force-dynamic";

// 作者本人或管理员可操作
async function canManage(req: NextRequest, id: string): Promise<{ ok: false; res: NextResponse } | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  const db = getDb();
  const row = getArticleRow(db, id);
  if (!row) return { ok: false, res: NextResponse.json({ error: "稿件不存在" }, { status: 404 }) };
  const owner = getArticleOwner(db, id);
  if (owner !== user.id && user.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "无权操作此稿件" }, { status: 403 }) };
  }
  return { ok: true, user };
}

// PATCH /api/articles/[id] { title?, summary?, category?, source?, tags?, status? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await canManage(req, id);
  if (!gate.ok) return gate.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const fields: Record<string, unknown> = {};
  if (body?.title !== undefined) {
    const t = String(body.title).trim();
    if (!t || t.length > 120) return NextResponse.json({ error: "标题不合法" }, { status: 400 });
    fields.title = t;
  }
  if (body?.summary !== undefined) {
    const s = body.summary ? String(body.summary).trim() : null;
    if (s && s.length > 2000) return NextResponse.json({ error: "摘要过长" }, { status: 400 });
    fields.summary = s;
  }
  if (body?.category !== undefined) fields.category = String(body.category);
  if (body?.source !== undefined) fields.source = body.source ? String(body.source).trim().slice(0, 60) : null;
  if (body?.tags !== undefined) {
    fields.tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
      : [];
  }
  if (body?.status !== undefined) {
    const s = body.status;
    fields.status = s === "draft" || s === "pending" || s === "published" || s === "rejected" ? s : "published";
  }
  if (body?.cover !== undefined) fields.cover = body.cover ? String(body.cover).slice(0, 200) : null;
  if (body?.reviewNote !== undefined) fields.reviewNote = body.reviewNote ? String(body.reviewNote).slice(0, 300) : null;
  const db = getDb();
  // 回收站恢复
  if (body?.restore === true) {
    setArticleDeleted(db, id, false);
    revalidateArticle(id);
    return NextResponse.json({ ok: true });
  }
  updateUserArticle(db, id, fields as never);
  revalidateArticle(id);
  return NextResponse.json({ ok: true });
}

// DELETE /api/articles/[id] -> 软删除（作者或管理员）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await canManage(req, id);
  if (!gate.ok) return gate.res;
  const db = getDb();
  setArticleDeleted(db, id, true);
  revalidateArticle(id);
  return NextResponse.json({ ok: true });
}
