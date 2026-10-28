import { NextRequest, NextResponse } from "next/server";
import { getDb, createUser, getUserByUsername, addPoints, createMessage } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { clientIp, hit } from "@/lib/ratelimit";
import { POINTS_WELCOME } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  // 注册同样要限流：真实 circumstances 下这是最常见的灌号/撞库入口
  const rl = hit("register:" + clientIp(req), 8, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "注册过于频繁，请稍后再试" }, { status: 429 });
  }

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
  if (password.length > 128) {
    return NextResponse.json({ error: "密码过长" }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const db = getDb();
  if (getUserByUsername(db, username)) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }
  if (email) {
    const dup = db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").get(email) as { id: number } | undefined;
    if (dup) return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
  }
  const id = createUser(db, username, email, password);
  if (!id) {
    return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
  }

  // 新会员礼包：积分 + 欢迎消息 + 引导消息，注册即有正反馈
  const pts = addPoints(db, id, POINTS_WELCOME, "welcome");
  createMessage(db, id, "欢迎加入", `欢迎你，${username}！注册礼包 ${POINTS_WELCOME} 积分已到账，当前积分 ${pts}。`, "system");
  createMessage(db, id, "开始创作", "你可以直接投稿：写好正文后提交审核，通过后即可上线并获得 20 积分奖励。", "system");

  await startSession(id);
  return NextResponse.json({ ok: true, user: { id, username, email, role: "user" } }, { status: 201 });
}
