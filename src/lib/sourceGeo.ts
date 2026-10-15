// 信号源地理映射：RSS 源域名 → 城市代码 + 地图坐标（SVG viewBox 680x250）
// 服务端（首页汇总）与客户端（信息流过滤）共用，保持单一事实源。

export interface GeoPoint {
  code: string;
  x: number;
  y: number;
}

const GEO: Record<string, GeoPoint> = {
  "36kr.com": { code: "BJS", x: 455, y: 70 },
  "ifanr.com": { code: "BJS", x: 455, y: 70 },
  "sspai.com": { code: "BJS", x: 455, y: 70 },
  "qbitai.com": { code: "BJS", x: 455, y: 70 },
  "feedx.net": { code: "BJS", x: 455, y: 70 },
  "bbc.co.uk": { code: "LON", x: 320, y: 62 },
  "theverge.com": { code: "NYC", x: 185, y: 85 },
  "cnbc.com": { code: "NYC", x: 185, y: 85 },
  "variety.com": { code: "NYC", x: 185, y: 85 },
  "sciencedaily.com": { code: "NYC", x: 185, y: 85 },
  "espn.com": { code: "NYC", x: 185, y: 85 },
  "news.ycombinator.com": { code: "NYC", x: 185, y: 85 },
  "france24.com": { code: "PAR", x: 332, y: 74 },
  "yna.co.kr": { code: "ICN", x: 505, y: 92 },
  "xataka.com": { code: "MAD", x: 298, y: 108 },
  "bolsamania.com": { code: "MAD", x: 298, y: 108 },
  "marca.com": { code: "MAD", x: 298, y: 108 },
  "elmundo.es": { code: "MAD", x: 298, y: 108 },
};

const KEYS = Object.keys(GEO);

function bareHost(url?: string): string {
  if (!url) return "";
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.indexOf("www.") === 0 ? h.slice(4) : h;
  } catch {
    return "";
  }
}

// 文章源 URL → 地理点（子域名后缀匹配，如 feeds.bbci.co.uk → bbc.co.uk）
export function geoOf(url?: string): GeoPoint | undefined {
  const h = bareHost(url);
  if (!h) return undefined;
  for (const k of KEYS) {
    if (h === k || h.indexOf("." + k, h.length - k.length - 1) !== -1) return GEO[k];
  }
  return undefined;
}

export function geoCodeOf(url?: string): string | undefined {
  return geoOf(url) && geoOf(url)!.code;
}
