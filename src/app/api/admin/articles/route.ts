import { NextRequest, NextResponse } from "next/server";
import { getDb, queryArticles, updateArticlePin, setArticleDeleted, updateArticle } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || undefined;
  const locale = sp.get("locale") || undefined;
  const includeDeleted = sp.get("includeDeleted") === "1";
  const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);
  const db = getDb();
  const list = queryArticles(db, {
    q,
    locale,
    includeDeleted,
    limit: 30,
    offset: page * 30,
  });
  return NextResponse.json({ items: list, page });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const body = await req.json().catch(() => ({}));
  const { id, action, title, summary, category, source } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const db = getDb();
  if (action === "pin") updateArticlePin(db, id, true);
  else if (action === "unpin") updateArticlePin(db, id, false);
  else if (action === "delete") setArticleDeleted(db, id, true);
  else if (action === "restore") setArticleDeleted(db, id, false);
  else if (action === "edit")
    updateArticle(db, id, { title, summary, category, source });
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
