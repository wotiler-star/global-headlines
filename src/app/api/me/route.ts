import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  queryArticles,
  getPoints,
  getPointLedger,
  unreadMessageCount,
  getAdStats,
  updateUserProfile,
  getUserById,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isCategory } from "@/i18n/config";

export const dynamic = "force-dynamic";

// GET /api/me -> 会员中心概览数据
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const db = getDb();
  const full = getUserById(db, user.id);
  // getUserById 不含迁移新增列，单独查积分/余额/资料
  const extra = db
    .prepare("SELECT points, balance, avatar, bio FROM users WHERE id = ?")
    .get(user.id) as { points: number; balance: number; avatar: string | null; bio: string | null } | undefined;
  const mine = queryArticles(db, { ownerId: user.id, includeDeleted: true, includeDrafts: true, limit: 100 });
  const counts = {
    articles: mine.filter((a) => !(a as { deleted?: number }).deleted).length,
    drafts: mine.filter((a) => !(a as { deleted?: number }).deleted && (a as { status?: string }).status === "draft").length,
    comments: (db.prepare("SELECT COUNT(*) AS c FROM comments WHERE user_id = ?").get(user.id) as { c: number }).c,
    bookmarks: (db.prepare("SELECT COUNT(*) AS c FROM bookmarks WHERE user_id = ?").get(user.id) as { c: number }).c,
    follows: (db.prepare("SELECT COUNT(*) AS c FROM follows WHERE user_id = ?").get(user.id) as { c: number }).c,
  };
  return NextResponse.json({
    user: full
      ? {
          id: full.id,
          username: full.username,
          email: full.email,
          role: full.role,
          banned: full.banned,
          created_at: full.created_at,
          points: extra ? extra.points : getPoints(db, user.id),
          balance: extra ? extra.balance : 0,
          avatar: extra ? extra.avatar : null,
          bio: extra ? extra.bio : null,
        }
      : null,
    counts,
    unread: unreadMessageCount(db, user.id),
    ad: getAdStats(db, user.id),
    ledger: getPointLedger(db, user.id, 30).map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      ref: r.ref,
      createdAt: r.created_at,
    })),
  });
}

// PATCH /api/me { avatar?, bio? } -> 更新个人资料
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const fields: { avatar?: string | null; bio?: string | null } = {};
  if (body?.avatar !== undefined) {
    const a = String(body.avatar).trim();
    if (a.length > 8) return NextResponse.json({ error: "头像仅支持 1-8 个字符" }, { status: 400 });
    fields.avatar = a || null;
  }
  if (body?.bio !== undefined) {
    const b = String(body.bio).trim();
    if (b.length > 200) return NextResponse.json({ error: "简介不超过 200 字" }, { status: 400 });
    fields.bio = b || null;
  }
  const db = getDb();
  updateUserProfile(db, user.id, fields);
  return NextResponse.json({ ok: true });
}
