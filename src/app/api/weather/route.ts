import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// WMO 天气码 -> emoji（免翻译，多语言通用）
const WMO: Record<number, string> = {
  0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌦", 56: "🌦", 57: "🌦",
  61: "🌧", 63: "🌧", 65: "🌧", 66: "🌧", 67: "🌧",
  71: "🌨", 73: "🌨", 75: "🌨", 77: "🌨",
  80: "🌦", 81: "🌧", 82: "🌧", 85: "🌨", 86: "🌨",
  95: "⛈", 96: "⛈", 99: "⛈",
};

type Payload = { city: string; temp: number; icon: string; code: number };

// 进程内缓存：同一 IP 10 分钟只查一次（ip-api 免费版 45 次/分钟）
const cache = new Map<string, { t: number; data: Payload | null }>();
const TTL = 10 * 60 * 1000;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  if (first) return first;
  return (req.headers.get("x-real-ip") || "").trim();
}

// GET /api/weather -> 访客所在城市天气：{ city, temp, icon, code }
// 任一步失败都返回 null（客户端据此隐藏天气块），绝不展示错误城市。
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const hit = cache.get(ip || "_");
  if (hit && Date.now() - hit.t < TTL) {
    return NextResponse.json({ weather: hit.data });
  }
  let data: Payload | null = null;
  try {
    const geoUrl = ip
      ? `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,city,lat,lon`
      : `http://ip-api.com/json/?lang=zh-CN&fields=status,city,lat,lon`;
    const geo = await fetch(geoUrl, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
    if (geo && geo.status === "success" && typeof geo.lat === "number") {
      const wx = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code`,
        { cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : null));
      const temp = wx?.current?.temperature_2m;
      if (typeof temp === "number") {
        const code = Number(wx?.current?.weather_code ?? -1);
        data = { city: String(geo.city || ""), temp: Math.round(temp), icon: WMO[code] || "🌡", code };
      }
    }
  } catch {
    data = null;
  }
  cache.set(ip || "_", { t: Date.now(), data });
  return NextResponse.json({ weather: data });
}
