import { NextResponse } from "next/server";
import { getArticles } from "@/data/newsSource";
import { locales, isLocale, Locale } from "@/i18n/config";
import { aggregateRegions } from "@/lib/sourceGeo";

// cov41 地球仪实时化：首页 SignalDeck 每 60s 轮询本接口刷新左侧城市榜 / 右侧地区面板，
// 不再依赖 SSR 一次性下发的静态 regions（此前页面不刷新数据就冻结）。
// 服务端 60s 模块级缓存：多访客共享同一次 aggregateRegions 计算（万篇级纯内存聚合，开销可控）。
export const dynamic = "force-dynamic";

const TTL = 60_000;
const cache = new Map<string, { ts: number; regions: ReturnType<typeof aggregateRegions> }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("lang") || "en";
  const locale: Locale = isLocale(raw) ? raw : "en";

  let hit = cache.get(locale);
  if (!hit || Date.now() - hit.ts > TTL) {
    const items = (await Promise.all(locales.map((l) => getArticles(l)))).flat();
    hit = { ts: Date.now(), regions: aggregateRegions(items, locale) };
    cache.set(locale, hit);
  }

  return NextResponse.json(
    { regions: hit.regions, ts: hit.ts },
    { headers: { "Cache-Control": "no-store" } }
  );
}
