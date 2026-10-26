import { NextRequest, NextResponse } from "next/server";
import { getDb, getUserByUsername, verifyPassword, updateUserPassword } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/me/password { oldPassword, newPassword } -> 修改密码（需登录 + 原密码校验）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }
  const oldPassword = String(body?.oldPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (!oldPassword || !newPassword) {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ code: "too_short" }, { status: 400 });
  }
  const db = getDb();
  const row = getUserByUsername(db, user.username);
  if (!row) return NextResponse.json({ code: "unauthorized" }, { status: 404 });
  const ok = await verifyPassword(oldPassword, row.password_hash);
  if (!ok) return NextResponse.json({ code: "wrong_old" }, { status: 400 });
  updateUserPassword(db, user.id, newPassword);
  return NextResponse.json({ ok: true });
}
