import { NextResponse } from "next/server";
import { getDb, createMessage } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/me/withdraw -> 申请提现：清零余额并通知全部管理员
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const db = getDb();
  const row = db.prepare("SELECT balance FROM users WHERE id = ?").get(user.id) as
    | { balance: number }
    | undefined;
  const balance = row?.balance ?? 0;
  if (balance <= 0) return NextResponse.json({ error: "当前无可提现余额" }, { status: 400 });
  db.prepare("UPDATE users SET balance = 0 WHERE id = ?").run(user.id);
  createMessage(db, user.id, "提现申请已提交", `已申请提现 ${balance} 分，平台客服将尽快处理。`, "system");
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as { id: number }[];
  for (const a of admins) {
    createMessage(db, a.id, "提现申请待处理", `用户 ${user.username} 申请提现 ${balance} 分。`, "system");
  }
  return NextResponse.json({ ok: true, withdrawn: balance });
}
