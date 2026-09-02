import { NextRequest, NextResponse } from "next/server";
import { getDb, listUsersAdmin, setUserBanned, setUserRole, deleteUser } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const db = getDb();
  return NextResponse.json({ items: listUsersAdmin(db) });
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const body = await req.json().catch(() => ({}));
  const { id, action } = body;
  if (typeof id !== "number") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  // 防止管理员把自己或唯一管理员误删/降权导致锁死
  const db = getDb();
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string } | undefined;
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (action === "ban") {
    if (target.role === "admin") return NextResponse.json({ error: "cannot ban admin" }, { status: 400 });
    setUserBanned(db, id, true);
  } else if (action === "unban") {
    setUserBanned(db, id, false);
  } else if (action === "promote") {
    setUserRole(db, id, "admin");
  } else if (action === "demote") {
    if (target.role !== "admin") return NextResponse.json({ ok: true });
    const adminCount = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get() as { c: number }).c;
    if (admin.id === id && adminCount <= 1)
      return NextResponse.json({ error: "cannot demote last admin" }, { status: 400 });
    setUserRole(db, id, "user");
  } else if (action === "delete") {
    if (target.role === "admin" && admin.id === id)
      return NextResponse.json({ error: "cannot delete yourself" }, { status: 400 });
    deleteUser(db, id);
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
