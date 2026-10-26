import { NextRequest, NextResponse } from "next/server";
import { getDb, getHotBoardStats } from "@/lib/db";
import { isLocale, isCategory } from "@/i18n/config";

export const dynamic = "force-dynamic";

// GET /api/stats/hot?locale=zh&category=tech&limit=10&hours=72
// -> { items:[{id,title,category,locale,publishedAt,views,recentViews,comments,score}], category, hours }
// 榜单 = 窗口内阅读*3 + 累计阅读*0.5 + 评论*6 + 发布时效(24h 半衰)*10 + 内容热度
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const localeParam = sp.get("locale") || "";
  const catParam = sp.get("category") || "";
  const limit = Math.min(Math.max(1, Number(sp.get("limit") || 10) || 10), 50);
  const hours = Math.min(Math.max(1, Number(sp.get("hours") || 72) || 72), 720);
  const items = getHotBoardStats(getDb(), {
    locale: isLocale(localeParam) ? localeParam : undefined,
    category: isCategory(catParam) ? catParam : undefined,
    limit,
    hours,
  });
  return NextResponse.json({ items, category: isCategory(catParam) ? catParam : "all", hours });
}
