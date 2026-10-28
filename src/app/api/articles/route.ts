import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { hit } from "@/lib/ratelimit";
import { isLocale, isCategory } from "@/i18n/config";
import {
  sanitizeBody,
  deriveSummary,
  countWords,
  resolveTargetStatus,
  MAX_SUMMARY_CHARS,
  MIN_BODY_CHARS,
  POINTS_PUBLISH,
} from "@/lib/moderation";

export const dynamic = "force-dynamic";

function serialize(a: DbArticle) {
  return {
    id: a.id,
    locale: a.locale,
    category: a.category,
    title: a.title,
    summary: a.summary,
    source: a.source,
    author: a.author,
    publishedAt: a.published_at,
    imageCount: a.image_count,
    images: JSON.parse(a.images || "[]"),
    tags: JSON.parse(a.tags || "[]"),
    readMinutes: a.read_minutes,
    media: a.media,
    videoPlatform: a.video_platform,
    videoId: a.video_id,
    sourceUrl: a.source_url,
    cover: (a as any).cover ?? null,
    commentCount: (a as any).comment_count || 0,
  };
}

// GET /api/articles?locale=zh&category=tech&q=...&tag=...&limit=30&offset=0
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const localeParam = sp.get("locale") || "";
  const categoryParam = sp.get("category") || "";
  const q = sp.get("q") || undefined;
  const tag = sp.get("tag") || undefined;
  const limit = Math.min(Number(sp.get("limit") || 30) || 30, 100);
  const offset = Number(sp.get("offset") || 0) || 0;
  const sort = sp.get("sort") || undefined;
  const pinned = sp.get("pinned") === "1";

  const db = getDb();
  const rows = queryArticles(db, {
    locale: isLocale(localeParam) ? localeParam : undefined,
    category: isCategory(categoryParam) ? categoryParam : undefined,
    q,
    tag,
    limit,
    offset,
    orderBy: sort === "comments" ? "comments" : sort === "new" ? "new" : undefined,
    pinnedOnly: pinned,
  });
  return NextResponse.json({ articles: rows.map(serialize), nextOffset: offset + rows.length });
}

// POST /api/articles { locale, category, title, summary?, source?, tags?, status? } -> 创建我的稿件
export async function POST(req: NextRequest) {
  const { getCurrentUser } = await import("@/lib/auth");
  const { createUserArticle, addPoints, createMessage } = await import("@/lib/db");
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (user.banned === 1) return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
  // 投稿限流：防止脚本刷量占满审核队列
  const rl = hit("post:" + user.id, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "投稿过于频繁，请稍后再试" }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const locale = String(body?.locale ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const content = sanitizeBody(body?.body);
  const summaryRaw = body?.summary ? String(body.summary).trim() : "";
  const summary = (summaryRaw || deriveSummary(content)).slice(0, MAX_SUMMARY_CHARS);
  const source = body?.source ? String(body.source).trim().slice(0, 60) : null;
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
    : [];
  // 状态由统一状态机裁决：未显式传值时按「发布」意图处理
  const desired = String(body?.status ?? "published");
  const status = resolveTargetStatus(user, null, desired);

  if (!isLocale(locale)) return NextResponse.json({ error: "语言参数不合法" }, { status: 400 });
  if (!isCategory(category)) return NextResponse.json({ error: "分类参数不合法" }, { status: 400 });
  if (!title || title.length > 120) return NextResponse.json({ error: "标题必填且不超过 120 字" }, { status: 400 });
  if (summary && summary.length > MAX_SUMMARY_CHARS)
    return NextResponse.json({ error: `摘要不超过 ${MAX_SUMMARY_CHARS} 字` }, { status: 400 });
  // 草稿允许留白；一旦进入发布/审核流程就必须有可审的正文
  if (status !== "draft" && content.length < MIN_BODY_CHARS)
    return NextResponse.json({ error: `正文至少需要 ${MIN_BODY_CHARS} 字才能提交审核` }, { status: 400 });

  const db = getDb();
  const id = createUserArticle(db, user.id, {
    locale,
    category,
    title,
    summary,
    source,
    tags,
    cover: body?.cover ? String(body.cover).slice(0, 200) : null,
    body: content,
    wordCount: countWords(content),
    status,
  });
  if (status === "published") {
    const pts = addPoints(db, user.id, POINTS_PUBLISH, "publish", id);
    createMessage(db, user.id, "稿件已发布", `《${title}》已上线，奖励 ${POINTS_PUBLISH} 积分，当前积分 ${pts}。`, "system");
  } else if (status === "pending") {
    createMessage(db, user.id, "稿件已提交审核", `《${title}》已提交审核，通过后会自动上线并奖励 ${POINTS_PUBLISH} 积分。`, "system");
  } else {
    createMessage(db, user.id, "草稿已保存", `《${title}》已存入草稿箱，随时可以继续编辑。`, "system");
  }
  revalidatePath(`/${locale}`);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
