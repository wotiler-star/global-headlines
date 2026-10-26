import { NextRequest, NextResponse } from "next/server";
import { getDb, queryArticles } from "@/lib/db";
import { isLocale, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

export const dynamic = "force-dynamic";

// GET /api/search/suggest?locale=zh&q=科技&limit=8
// 返回分类建议（置顶，最多 3 个：q 命中分类本地化标签或 key）+ 文章标题建议
// （复用 queryArticles 的词典分词+IDF 排序），供搜索框边输入边出下拉。
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const locale = sp.get("locale") || "zh";
  const limit = Math.min(Number(sp.get("limit") || 8) || 8, 20);
  if (q.length < 1) return NextResponse.json({ suggestions: [] });

  // 分类建议：q 命中分类本地化标签（或 key）时置顶，点击进入该分类筛选结果
  const loc = isLocale(locale) ? locale : "zh";
  const dict = getDict(loc);
  const ql = q.toLowerCase();
  const catSugs = categories
    .filter((c) => c !== "recommend")
    .filter((c) => dict.categories[c].toLowerCase().includes(ql) || c.includes(ql))
    .slice(0, 3)
    .map((c) => ({ text: dict.categories[c], type: "category", cat: c }));

  const rows = queryArticles(getDb(), {
    locale: loc,
    q,
    limit: 50,
  });
  const seen = new Set<string>();
  const artSugs: { text: string; type: string }[] = [];
  for (const r of rows) {
    const t = r.title;
    if (t && !seen.has(t)) {
      seen.add(t);
      artSugs.push({ text: t, type: "article" });
      if (artSugs.length >= limit) break;
    }
  }
  return NextResponse.json({ suggestions: [...catSugs, ...artSugs].slice(0, limit) });
}
