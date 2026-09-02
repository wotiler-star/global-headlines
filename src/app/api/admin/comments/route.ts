import { NextRequest, NextResponse } from "next/server";
import { getDb, listCommentsAdmin, deleteCommentAdmin } from "@/lib/db";
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
  return NextResponse.json({ items: listCommentsAdmin(db, 200) });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const body = await req.json().catch(() => ({}));
  const { id, action } = body;
  if (typeof id !== "number") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const db = getDb();
  if (action === "delete") deleteCommentAdmin(db, id);
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
