import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const db = getDb();
  const row = db.prepare("SELECT avatar FROM users WHERE id = ?").get(user.id) as
    | { avatar: string | null }
    | undefined;
  return NextResponse.json({ user: { ...user, avatar: row?.avatar ?? null } });
}
