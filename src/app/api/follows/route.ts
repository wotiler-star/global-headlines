import { NextRequest, NextResponse } from "next/server";
import { getDb, getFollows, setFollow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/follows -> 当前登录用户的关注来源列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const db = getDb();
  return NextResponse.json({ follows: getFollows(db, user.id) });
}

// POST /api/follows { source, on } -> 切换关注状态
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const source = String(body?.source ?? "").trim();
  const on = Boolean(body?.on);
  if (!source) {
    return NextResponse.json({ error: "source 必填" }, { status: 400 });
  }
  const db = getDb();
  setFollow(db, user.id, source, on);
  return NextResponse.json({ ok: true, follows: getFollows(db, user.id) });
}
