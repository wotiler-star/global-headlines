import { cookies, headers } from "next/headers";
import { getDb, createSession, getUserBySession, deleteSession } from "./db";

export const SESSION_COOKIE = "gh_session";
export const SESSION_TTL = 30 * 24 * 3600 * 1000;

export type SessionUser = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  banned: number;
  created_at: number;
};

// 读取当前登录用户（基于 httpOnly 会话 cookie）。无登录返回 null。
export async function getCurrentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const u = getUserBySession(db, token);
  return u
    ? { id: u.id, username: u.username, email: u.email, role: u.role, banned: u.banned, created_at: u.created_at }
    : null;
}

// 要求管理员权限；否则抛出 Response（由路由捕获返回 403）
export async function requireAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Response("Unauthorized", { status: 401 });
  if (u.role !== "admin" || u.banned === 1) throw new Response("Forbidden", { status: 403 });
  return u;
}

// 建立会话并写入 cookie（注册/登录成功后调用）
export async function startSession(userId: number): Promise<string> {
  const db = getDb();
  const token = createSession(db, userId, SESSION_TTL);
  // 仅当真实传输为 HTTPS 时才置 Secure，否则本地/HTTP 部署下浏览器会丢弃 cookie
  const h = await headers();
  const isHttps = h.get("x-forwarded-proto") === "https";
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL / 1000),
    secure: isHttps,
  });
  return token;
}

// 注销：删除服务端会话记录 + 清除 cookie
export async function endSession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    deleteSession(db, token);
  }
  c.delete(SESSION_COOKIE);
}
