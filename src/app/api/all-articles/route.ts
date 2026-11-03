import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/data/newsSource";
import { locales } from "@/i18n/config";
import { geoCodeOf } from "@/lib/sourceGeo";

// cov39 首屏瘦身：首页地球仪「点地区(?src=)」跨语种筛选此前依赖 SSR 把全 8 语种约万篇
// 文章元数据(剥 body)整体塞进 RSC payload，导致首屏 HTML 8-9MB、每个访客白付 5.7MB。
// 改为按需拉取：仅当用户真正点开某地区时，客户端才请求本接口；默认首屏只下发当前语种文章。
// 返回形状与首页原 slimAll 完全一致(Article[]，body 已剥离)，客户端零适配。
//
// cov51 修复：全量响应 ~3.2MB，经公网/小带宽链路传输可达 25s+，浏览器 r.json() 长期
// pending，分站落地页(?src=)卡在 Loading。支持 ?src=JKT 服务端按地区过滤（与前端
// geoCodeOf 同一映射），单地区响应仅数十 KB，秒开；无参调用保持全量旧行为。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const src = (req.nextUrl.searchParams.get("src") || "").trim().toUpperCase();
  let items = (await Promise.all(locales.map((l) => getArticles(l)))).flat();
  if (src) items = items.filter((a) => geoCodeOf(a.sourceUrl) === src);
  const slim = items.map((a) => ({ ...a, body: [] as string[] }));
  return NextResponse.json(
    { articles: slim },
    { headers: { "Cache-Control": "public, max-age=120" } }
  );
}
