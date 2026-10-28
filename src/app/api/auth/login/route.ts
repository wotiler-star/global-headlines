import { NextRequest, NextResponse } from "next/server";
import { getDb, getUserByUsername, verifyPassword } from "@/lib/db";
import { startSession, SESSION_TTL_REMEMBER } from "@/lib/auth";
import { clientIp, hit, reset } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// 同一 IP 对准同一用户名：10 分钟内最多 8 次失败，防止暴力破解；成功即清零
const FAIL_LIMIT = 8;
const FAIL_WINDOW = 10 * 60 * 1000;

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

  const rlKey = "login:" + clientIp(req) + ":" + username.toLowerCase();
  const rl = hit(rlKey, FAIL_LIMIT, FAIL_WINDOW);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `尝试次数过多，请在 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后重试` },
      { status: 429 }
    );
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
    return NextResponse.json({ error: "账号已被封禁，如有疑问请联系管理员" }, { status: 403 });
  }

  const remember = body?.remember === true;
  await startSession(user.id, remember ? SESSION_TTL_REMEMBER : undefined);
  reset(rlKey);
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: (user as { avatar?: string | null }).avatar ?? null,
    },
  });
}
