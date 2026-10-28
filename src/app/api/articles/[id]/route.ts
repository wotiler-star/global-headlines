import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, getArticleRow, getArticleOwner, updateUserArticle, setArticleDeleted, createMessage } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  sanitizeBody,
  deriveSummary,
  countWords,
  resolveTargetStatus,
  parseStatus,
  enteredReview,
  MAX_SUMMARY_CHARS,
  MIN_BODY_CHARS,
} from "@/lib/moderation";

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
  const db = getDb();
  const current = getArticleRow(db, id);
  const fields: Record<string, unknown> = {};
  if (body?.title !== undefined) {
    const t = String(body.title).trim();
    if (!t || t.length > 120) return NextResponse.json({ error: "标题不合法" }, { status: 400 });
    fields.title = t;
  }
  if (body?.body !== undefined) fields.body = sanitizeBody(body.body);
  if (body?.summary !== undefined) {
    const s = body.summary ? String(body.summary).trim() : "";
    if (s && s.length > MAX_SUMMARY_CHARS)
      return NextResponse.json({ error: `摘要不超过 ${MAX_SUMMARY_CHARS} 字` }, { status: 400 });
    fields.summary = s || null;
  }
  if (body?.category !== undefined) fields.category = String(body.category);
  if (body?.source !== undefined) fields.source = body.source ? String(body.source).trim().slice(0, 60) : null;
  if (body?.tags !== undefined) {
    fields.tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
      : [];
  }
  if (body?.cover !== undefined) fields.cover = body.cover ? String(body.cover).slice(0, 200) : null;
  if (body?.reviewNote !== undefined) fields.reviewNote = body.reviewNote ? String(body.reviewNote).slice(0, 300) : null;

  const prevStatus = parseStatus((current as { status?: string } | undefined)?.status, "published");
  let nextStatus: ReturnType<typeof parseStatus> | null = null;
  if (body?.status !== undefined) {
    // 与新建路径共用同一套裁决，杜绝「先过审再编辑成 published」绕过审核
    nextStatus = resolveTargetStatus(gate.user, prevStatus, body.status);
    fields.status = nextStatus;
  }
  // 合并后的正文才是最终落库内容：部分更新时要用「已有 + 本次」判断字数是否达标
  const effectiveBody =
    typeof fields.body === "string" ? (fields.body as string) : (current?.body ?? current?.summary ?? "");
  const finalStatus = nextStatus ?? prevStatus;
  // 只在「显式提交」时校验正文字数：避免历史短稿件的普通存盘被卡住
  if (nextStatus && nextStatus !== "draft" && String(effectiveBody).length < MIN_BODY_CHARS) {
    return NextResponse.json({ error: `正文至少需要 ${MIN_BODY_CHARS} 字才能提交审核` }, { status: 400 });
  }
  if (typeof fields.body === "string") fields.wordCount = countWords(fields.body);
  if (String(fields.summary ?? current?.summary ?? "").length === 0 && effectiveBody) {
    fields.summary = deriveSummary(String(effectiveBody)).slice(0, MAX_SUMMARY_CHARS);
  }
  // 首次上线：刷新 published_at，让稿件出现在信息流顶部
  if (nextStatus === "published" && prevStatus !== "published") fields.publishedAt = Date.now();

  // 回收站恢复
  if (body?.restore === true) {
    setArticleDeleted(db, id, false);
    revalidateArticle(id);
    return NextResponse.json({ ok: true, status: prevStatus });
  }
  updateUserArticle(db, id, fields as never);
  if (nextStatus && enteredReview(prevStatus, nextStatus)) {
    createMessage(
      db,
      gate.user.id,
      prevStatus === "published" ? "稿件更新待再审" : "稿件已提交审核",
      `《${fields.title ?? current?.title ?? "稿件"}》已进入审核队列，通过后会自动上线。`,
      "system"
    );
  }
  revalidateArticle(id);
  return NextResponse.json({ ok: true, status: finalStatus });
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
