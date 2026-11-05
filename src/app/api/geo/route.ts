import { NextRequest, NextResponse } from "next/server";
import { countryToLocale, countryToDisplayLocale } from "@/i18n/geoLocale";

// 访客 IP → 国家 → 建议语种。
// 前端 GeoLocaleGuard 首次访问时调用一次；结果写入 cookie，之后不再请求。
// 双通道 + 超时降级：任一外部服务不可达都不影响页面，仅返回 "unknown"。
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL = 24 * 60 * 60_000; // 按 IP 缓存 24h
const cache = new Map<string, { ts: number; data: GeoResult }>();
const MAX_CACHE = 5000;

type GeoResult = {
  country: string;
  locale: string;
  displayLocale: string;
  source: "ipwho.is" | "ipapi.co" | "header" | "unknown";
};

function result(country: string, source: GeoResult["source"]): GeoResult {
  return {
    country,
    locale: countryToLocale(country),
    displayLocale: countryToDisplayLocale(country),
    source,
  };
}

/** 只取可信代理链里的第一个公网 IP，过滤内网/保留地址 */
function clientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for") || "";
  const candidates = [
    req.headers.get("x-real-ip"),
    ...xff.split(",").map((s) => s.trim()),
  ];
  for (const raw of candidates) {
    const ip = (raw || "").trim();
    if (!ip) continue;
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (v4) {
      const o = v4.slice(1).map(Number);
      if (o.every((n) => n >= 0 && n <= 255) &&
          !(o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
            (o[0] === 192 && o[1] === 168) || o[0] === 127 || o[0] === 0 ||
            (o[0] === 169 && o[1] === 254))) return ip;
    } else if (ip.includes(":") && !ip.startsWith("::ffff:10.") && ip !== "::1") {
      return ip; // IPv6 公网
    }
  }
  return undefined;
}

async function fetchJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookup(ip: string): Promise<GeoResult> {
  // 主通道：ipwho.is（免费、无需 key、返回 country_code）
  const a = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`, 1500);
  const ccA = typeof a?.country_code === "string" ? a.country_code : undefined;
  if (a && a.success !== false && ccA && /^[A-Za-z]{2}$/.test(ccA)) {
    return result(ccA.toUpperCase(), "ipwho.is");
  }
  // 备通道：ipapi.co
  const b = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, 1500);
  const ccB = (typeof b?.country_code === "string" ? b.country_code : undefined) ||
              (typeof b?.country === "string" ? b.country : undefined);
  if (ccB && /^[A-Za-z]{2}$/.test(ccB) && !b?.error) {
    return result(ccB.toUpperCase(), "ipapi.co");
  }
  return result("", "unknown");
}

export async function GET(req: NextRequest) {
  // 反代已注入国家头时优先使用，省一次外网请求
  const h = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") ||
             req.headers.get("x-country-code") || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(h) && h !== "XX") {
    return NextResponse.json(result(h, "header"), { headers: { "Cache-Control": "private, no-store" } });
  }

  const ip = clientIp(req);
  if (!ip) {
    return NextResponse.json(result("", "unknown"), { headers: { "Cache-Control": "private, no-store" } });
  }

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data, { headers: { "Cache-Control": "private, no-store", "X-Geo-Cache": "hit" } });
  }

  const data = await lookup(ip);
  if (cache.size >= MAX_CACHE) {
    // 简单淘汰：清掉最早插入的一批
    for (const k of cache.keys()) { cache.delete(k); if (cache.size < MAX_CACHE * 0.8) break; }
  }
  cache.set(ip, { ts: Date.now(), data });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", "X-Geo-Cache": "miss" } });
}
