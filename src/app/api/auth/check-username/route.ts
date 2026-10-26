import { NextRequest, NextResponse } from "next/server";
import { getDb, getUserByUsername } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;

// GET /api/auth/check-username?username=xxx -> { available }
export async function GET(req: NextRequest) {
  const u = (req.nextUrl.searchParams.get("username") || "").trim();
  if (!USER_RE.test(u)) return NextResponse.json({ available: false });
  const db = getDb();
  return NextResponse.json({ available: !getUserByUsername(db, u) });
}
