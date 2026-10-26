import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, queryArticles, DbArticle } from "@/lib/db";
import { isLocale, isCategory } from "@/i18n/config";

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const locale = String(body?.locale ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const summary = body?.summary ? String(body.summary).trim() : null;
  const source = body?.source ? String(body.source).trim().slice(0, 60) : null;
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
    : [];
  const rawStatus = body?.status;
  let status: "draft" | "pending" | "published" | "rejected" =
    rawStatus === "draft" || rawStatus === "pending" || rawStatus === "published" || rawStatus === "rejected"
      ? rawStatus
      : "published";
  // 普通会员"发布"一律进入待审核；管理员可直发；rejected 状态不允许由客户端直接写入
  if (user.role !== "admin") {
    if (status === "published") status = "pending";
    if (status === "rejected") status = "pending";
  }

  if (!isLocale(locale)) return NextResponse.json({ error: "语言参数不合法" }, { status: 400 });
  if (!isCategory(category)) return NextResponse.json({ error: "分类参数不合法" }, { status: 400 });
  if (!title || title.length > 120) return NextResponse.json({ error: "标题必填且不超过 120 字" }, { status: 400 });
  if (summary && summary.length > 2000) return NextResponse.json({ error: "摘要不超过 2000 字" }, { status: 400 });

  const db = getDb();
  const id = createUserArticle(db, user.id, { locale, category, title, summary, source, tags, cover: body?.cover ? String(body.cover).slice(0, 200) : null, status });
  if (status === "published") {
    const pts = addPoints(db, user.id, 20, "publish", id);
    createMessage(db, user.id, "稿件已发布", `《${title}》已上线，奖励 20 积分，当前积分 ${pts}。`, "system");
  } else if (status === "pending") {
    createMessage(db, user.id, "稿件已提交审核", `《${title}》已提交审核，通过后将自动上线。`, "system");
  } else {
    createMessage(db, user.id, "草稿已保存", `《${title}》已存入草稿箱。`, "system");
  }
  revalidatePath(`/${locale}`);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
