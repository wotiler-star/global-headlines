import { NextResponse } from "next/server";
import { getDb, addPoints, lastCheckinAt, createMessage, getPoints } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

// POST /api/me/checkin -> 每日签到（同一天重复返回 409）
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const db = getDb();
  const last = lastCheckinAt(db, user.id);
  if (last && sameDay(last, Date.now())) {
    return NextResponse.json({ error: "今日已签到，明天再来吧", points: getPoints(db, user.id) }, { status: 409 });
  }
  const points = addPoints(db, user.id, 5, "checkin");
  createMessage(db, user.id, "签到成功", "每日签到 +5 积分，当前积分 " + points + "。", "system");
  return NextResponse.json({ ok: true, points });
}
