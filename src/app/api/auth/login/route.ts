import { NextRequest, NextResponse } from "next/server";
import { getDb, getUserByUsername, verifyPassword } from "@/lib/db";
import { startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }

  const db = getDb();
  const user = getUserByUsername(db, username);
  if (!user) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  if (user.banned === 1) {
    return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
  }
  await startSession(user.id);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
}
