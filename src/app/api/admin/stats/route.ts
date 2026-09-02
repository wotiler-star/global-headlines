import { NextResponse } from "next/server";
import { getDb, getAdminStats } from "@/lib/db";
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
  return NextResponse.json(getAdminStats(db));
}
