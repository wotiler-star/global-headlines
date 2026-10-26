import { NextRequest, NextResponse } from "next/server";
import { getDb, recordAdEvent, getArticleOwner, creditBalance, createMessage } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const REVENUE: Record<string, number> = { impression: 1, click: 5 };
const SHARE = 0.6; // 作者分成比例

// POST /api/ads/event { articleId?, kind: 'impression' | 'click' }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const kind = String(body?.kind ?? "");
  const articleId = body?.articleId ? String(body.articleId).trim() : null;
  if (!(kind in REVENUE)) return NextResponse.json({ error: "kind 不合法" }, { status: 400 });

  const user = await getCurrentUser();
  const db = getDb();
  const owner = articleId ? getArticleOwner(db, articleId) : null;
  const gross = REVENUE[kind];
  const share = owner ? Math.round(gross * SHARE) : 0;
  // 事件归属到作者（会员中心按作者统计广告收入）；无作者则记站方事件(user_id=NULL)
  recordAdEvent(db, owner, articleId, kind, share);
  if (owner && share > 0) {
    const balance = creditBalance(db, owner, share);
    // 点击价值更高，给作者发一条分成消息（曝光太频繁，不打扰）
    if (kind === "click") {
      createMessage(
        db,
        owner,
        "广告分成入账",
        `你的稿件获得一次广告点击，分成 +${share} 分，当前余额 ${balance} 分。`,
        "reward"
      );
    }
  }
  return NextResponse.json({ ok: true });
}
