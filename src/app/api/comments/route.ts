import { NextRequest, NextResponse } from "next/server";
import { getDb, getComments, addComment, CommentRow, getArticleRow, getArticleOwner, createMessage, addPoints, countTodayPointsByReason, recordUserEvent, commentLikeCounts, userLikedCommentIds } from "@/lib/db";
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
    parentId: c.parent_id ?? null,
  };
}

// GET /api/comments?articleId=xxx -> 某文章评论列表
export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId 必填" }, { status: 400 });
  }
  const db = getDb();
  const user = await getCurrentUser();
  const likeCounts = commentLikeCounts(db, articleId);
  const myLikes = user ? userLikedCommentIds(db, user.id, articleId) : new Set<number>();
  return NextResponse.json({
    comments: getComments(db, articleId).map((c) => ({
      ...serialize(c),
      likes: likeCounts.get(c.id) || 0,
      likedByMe: myLikes.has(c.id),
    })),
  });
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
  let parentId: number | null = null;
  if (body?.parentId != null) {
    const pid = Number(body.parentId);
    if (Number.isFinite(pid) && pid > 0) {
      const parent = getComments(db, articleId).find((c) => c.id === pid);
      if (parent) parentId = pid; // 仅允许回复同文章下的评论
    }
  }
  const row = addComment(db, articleId, authorName, text, user ? user.id : null, parentId);
  // 评论通知：稿件作者（非本人评论时）收到消息
  try {
    const owner = getArticleOwner(db, articleId);
    if (owner && (!user || user.id !== owner)) {
      const art = getArticleRow(db, articleId);
      createMessage(
        db,
        owner,
        "收到新评论",
        `${authorName} 评论了《${art?.title || articleId}》：${text.slice(0, 60)}`,
        "comment"
      );
    }
  } catch {
    /* 通知失败不影响评论主流程 */
  }
  // @提及通知：解析正文 @username（3-20 位字母数字下划线），通知被提及用户（排除本人、去重）
  try {
    const names = Array.from(new Set(Array.from(text.matchAll(/@([A-Za-z0-9_]{3,20})/g), (m) => m[1])));
    if (names.length) {
      const art = getArticleRow(db, articleId);
      for (const un of names) {
        if (user && un === user.username) continue;
        const u = db.prepare("SELECT id FROM users WHERE username = ?").get(un) as { id: number } | undefined;
        if (u && (!user || u.id !== user.id)) {
          createMessage(
            db,
            u.id,
            "有人在评论中提到了你",
            `${authorName} 在《${art?.title || articleId}》的评论中@了你：${text.slice(0, 60)}`,
            "mention"
          );
        }
      }
    }
  } catch {
    /* 通知失败不影响评论主流程 */
  }
  // 评论奖励 +2 积分（非本人稿件；每日最多 10 条计分，防刷）
  try {
    const owner2 = getArticleOwner(db, articleId);
    if (user && owner2 !== null && owner2 !== user.id && countTodayPointsByReason(db, user.id, "comment") < 10) {
      addPoints(db, user.id, 2, "comment", String(row.id));
    }
  } catch {
    /* 奖励失败不影响评论主流程 */
  }
  // 推荐画像：评论计入兴趣（comment 权重 2）
  if (user) {
    try {
      const clientCat = body?.category ? String(body.category).slice(0, 32) : null;
      const cat = clientCat || getArticleRow(db, articleId)?.category || null;
      if (cat) recordUserEvent(db, user.id, "comment", cat, 2, articleId);
    } catch {
      /* 忽略 */
    }
  }
  return NextResponse.json({ ok: true, comment: serialize(row) }, { status: 201 });
}
