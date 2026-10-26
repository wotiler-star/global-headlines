import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getDb,
  recordView,
  getViewCount,
  getArticleOwner,
  getArticleRow,
  addPoints,
  countTodayPointsByReason,
  recordAdEvent,
  creditBalance,
  createMessage,
  recordUserEvent,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const COOKIE = "gh_vid";

// 访客标识：优先复用 cookie，没有则生成并在响应里下发（用于同访客去重）
function viewerKey(req: NextRequest): { key: string; fresh: boolean } {
  const c = req.cookies.get(COOKIE)?.value;
  if (c && c.length >= 8) return { key: c, fresh: false };
  return { key: randomUUID(), fresh: true };
}

// POST /api/views { articleId, locale?, category? } -> 记一次阅读（同访客同文章只计一次）
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const articleId = String(body?.articleId ?? "").trim();
  if (!articleId || articleId.length > 160) {
    return NextResponse.json({ error: "articleId 必填且不超过 160 字符" }, { status: 400 });
  }
  const locale = body?.locale ? String(body.locale).slice(0, 8) : null;
  const category = body?.category ? String(body.category).slice(0, 32) : null;

  const { key, fresh } = viewerKey(req);
  const db = getDb();
  const isNew = recordView(db, articleId, key, locale, category);
  const views = getViewCount(db, articleId);

  // 推荐画像：登录用户的新增阅读计入兴趣（read 权重 1）
  if (isNew && category) {
    try {
      const { getCurrentUser } = await import("@/lib/auth");
      const u = await getCurrentUser();
      if (u) recordUserEvent(db, u.id, "read", category, 1, articleId);
    } catch {
      /* 画像记录失败不影响主流程 */
    }
  }

  // ---------- 阅读量结算：每 10 次有效阅读 -> 作者 +1 积分 + 1 分广告分成 ----------
  // 自读不计入结算；每日上限 30 次奖励，防止刷量。
  const STEP = 10;
  const DAILY_CAP = 30;
  let awarded: { points: number; share: number } | null = null;
  if (isNew && views > 0 && views % STEP === 0) {
    const owner = getArticleOwner(db, articleId);
    let self = false;
    try {
      const { getCurrentUser } = await import("@/lib/auth");
      const u = await getCurrentUser();
      if (u && owner && u.id === owner) self = true;
    } catch {
      /* 未登录或解析失败，按非自读处理 */
    }
    if (owner && !self && countTodayPointsByReason(db, owner, "view") < DAILY_CAP) {
      addPoints(db, owner, 1, "view", articleId);
      recordAdEvent(db, owner, articleId, "view", 1);
      const balance = creditBalance(db, owner, 1);
      awarded = { points: 1, share: 1 };
      if (views === 10 || views === 100 || views % 1000 === 0) {
        const t = getArticleRow(db, articleId)?.title || articleId;
        createMessage(
          db,
          owner,
          "阅读量达标",
          `《${t}》阅读量达到 ${views}，获得 1 积分与 1 分广告分成（当前余额 ${balance} 分）。`,
          "reward"
        );
      }
    }
  }

  const res = NextResponse.json({ ok: true, views, awarded });
  if (fresh) {
    res.cookies.set(COOKIE, key, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }
  return res;
}

// GET /api/views?articleId=xxx -> 该文章累计阅读量
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("articleId") || "";
  if (!id) return NextResponse.json({ error: "articleId 必填" }, { status: 400 });
  return NextResponse.json({ views: getViewCount(getDb(), id) });
}
