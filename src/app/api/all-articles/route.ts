import { NextResponse } from "next/server";
import { getArticles } from "@/data/newsSource";
import { locales } from "@/i18n/config";

// cov39 首屏瘦身：首页地球仪「点地区(?src=)」跨语种筛选此前依赖 SSR 把全 8 语种约万篇
// 文章元数据(剥 body)整体塞进 RSC payload，导致首屏 HTML 8-9MB、每个访客白付 5.7MB。
// 改为按需拉取：仅当用户真正点开某地区时，客户端才请求本接口；默认首屏只下发当前语种文章。
// 返回形状与首页原 slimAll 完全一致(Article[]，body 已剥离)，客户端零适配。
export const dynamic = "force-dynamic";

export async function GET() {
  const items = (await Promise.all(locales.map((l) => getArticles(l)))).flat();
  const slim = items.map((a) => ({ ...a, body: [] as string[] }));
  return NextResponse.json(
    { articles: slim },
    { headers: { "Cache-Control": "public, max-age=120" } }
  );
}
