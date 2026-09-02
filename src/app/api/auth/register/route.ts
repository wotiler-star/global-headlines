import { NextRequest, NextResponse } from "next/server";
import { getDb, createUser, getUserByUsername } from "@/lib/db";
import { startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const email = body?.email ? String(body.email).trim() : null;

  if (!USER_RE.test(username)) {
    return NextResponse.json({ error: "用户名需为 3-20 位字母/数字/下划线" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const db = getDb();
  if (getUserByUsername(db, username)) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }
  const id = createUser(db, username, email, password);
  if (!id) {
    return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
  }
  await startSession(id);
  return NextResponse.json({ ok: true, user: { id, username, email, role: "user" } }, { status: 201 });
}
