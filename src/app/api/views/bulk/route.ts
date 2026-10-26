import { NextRequest, NextResponse } from "next/server";
import { getDb, getViewCounts } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/views/bulk?ids=a,b,c -> { counts: { a: 12, b: 3 } }
// 信息流/列表页一次取多篇阅读量，避免每卡片各发一次请求。
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") || "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  return NextResponse.json({ counts: getViewCounts(getDb(), ids) });
}
