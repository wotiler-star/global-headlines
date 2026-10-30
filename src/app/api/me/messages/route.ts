import { NextRequest, NextResponse } from "next/server";
import { getDb, listMessages, markMessageRead, markAllMessagesRead, unreadMessageCount } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/me/messages -> 消息列表 + 未读数
export async function GET() {
  const user = await getCurrentUser();
  // 匿名访问：没登录就是没有消息，返回空列表而不是 401（避免每个页面都刷一条控制台错误）
  if (!user) return NextResponse.json({ items: [], unread: 0 });
  const db = getDb();
  return NextResponse.json({ items: listMessages(db, user.id, 50), unread: unreadMessageCount(db, user.id) });
}

// POST /api/me/messages { id? , all? } -> 标记已读
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const db = getDb();
  if (body?.all) markAllMessagesRead(db, user.id);
  else if (typeof body?.id === "number") markMessageRead(db, user.id, body.id);
  else return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  return NextResponse.json({ ok: true, unread: unreadMessageCount(db, user.id) });
}
