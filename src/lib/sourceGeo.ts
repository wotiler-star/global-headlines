// 信号源地理映射：RSS 源域名 → 城市代码；城市代码 → 经纬度 + 多语言名。
// 服务端（首页指标聚合）与客户端（信息流过滤）共用，保持单一事实源。

import { Locale } from "@/i18n/config";
import type { Article } from "@/data/news";

export interface GeoPoint {
  code: string;
  x: number;
  y: number;
}

// 城市注册表：经纬度（globe.gl 用）+ 多语言名称
interface City {
  lat: number;
  lng: number;
  names: Partial<Record<string, string>>;
}
const CITIES: Record<string, City> = {
  BJS: { lat: 39.9042, lng: 116.4074, names: { zh: "北京", en: "Beijing", ja: "北京", ko: "베이징", es: "Pekín", fr: "Pékin", de: "Peking" } },
  NYC: { lat: 40.7128, lng: -74.006, names: { zh: "纽约", en: "New York", ja: "ニューヨーク", ko: "뉴욕", es: "Nueva York", fr: "New York", de: "New York" } },
  LON: { lat: 51.5074, lng: -0.1278, names: { zh: "伦敦", en: "London", ja: "ロンドン", ko: "런던", es: "Londres", fr: "Londres", de: "London" } },
  PAR: { lat: 48.8566, lng: 2.3522, names: { zh: "巴黎", en: "Paris", ja: "パリ", ko: "파리", es: "París", fr: "Paris", de: "Paris" } },
  ICN: { lat: 37.5665, lng: 126.978, names: { zh: "首尔", en: "Seoul", ja: "ソウル", ko: "서울", es: "Seúl", fr: "Séoul", de: "Seoul" } },
  MAD: { lat: 40.4168, lng: -3.7038, names: { zh: "马德里", en: "Madrid", ja: "マドリッド", ko: "마드리드", es: "Madrid", fr: "Madrid", de: "Madrid" } },
};

// 域名 → 城市代码（SVG x,y 仅旧平面地图用，已弃）
const DOMAIN_TO_CODE: Record<string, string> = {
  "36kr.com": "BJS", "ifanr.com": "BJS", "sspai.com": "BJS", "qbitai.com": "BJS", "feedx.net": "BJS",
  "bbc.co.uk": "LON",
  "theverge.com": "NYC", "cnbc.com": "NYC", "variety.com": "NYC", "sciencedaily.com": "NYC", "espn.com": "NYC", "news.ycombinator.com": "NYC",
  "france24.com": "PAR",
  "yna.co.kr": "ICN",
  "xataka.com": "MAD", "bolsamania.com": "MAD", "marca.com": "MAD", "elmundo.es": "MAD",
};

// 地区运行时指标（首页地球面板用）
export interface RegionStat {
  code: string;
  name: string;
  lat: number;
  lng: number;
  signalCount: number;   // 信号量
  sources: number;
  sourcesList: string[];   // 活跃源域名列表(去重 top8)
  lastSignal: number;    // 最新信号 epoch ms
  topCategory: string;   // 主导分类 key
  categoryDist: { cat: string; n: number }[]; // 分类分布 top4
  activity: number;      // 活跃度 0-100（相对最大区）
}

function bareHost(url?: string): string {
  if (!url) return "";
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.indexOf("www.") === 0 ? h.slice(4) : h;
  } catch {
    return "";
  }
}

export function geoCodeOf(url?: string): string | undefined {
  const h = bareHost(url);
  if (!h) return undefined;
  for (const dom of Object.keys(DOMAIN_TO_CODE)) {
    if (h === dom || h.endsWith("." + dom)) return DOMAIN_TO_CODE[dom];
  }
  return undefined;
}

export function cityName(code: string, locale: Locale): string {
  const c = CITIES[code];
  if (!c) return code;
  return c.names[locale] || c.names.en || code;
}

// 从文章列表聚合各地区实时指标（按 locale 过滤）
export function aggregateRegions(articles: Article[], locale: Locale): RegionStat[] {
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    const code = geoCodeOf(a.sourceUrl);
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(a);
  }
  const out: RegionStat[] = [];
  let max = 1;
  for (const [code, items] of groups) {
    const city = CITIES[code];
    const sources = new Set(items.map((i) => bareHost(i.sourceUrl)).filter(Boolean));
    const last = items.reduce((m, i) => Math.max(m, i.publishedAt || 0), 0);
    const catCount = new Map<string, number>();
    for (const i of items) catCount.set(i.category, (catCount.get(i.category) || 0) + 1);
    const dist = [...catCount.entries()]
      .map(([cat, n]) => ({ cat, n }))
      .sort((a, b) => b.n - a.n);
    const top = dist[0]?.cat || "";
    out.push({
      code,
      name: cityName(code, locale),
      lat: city.lat,
      lng: city.lng,
      signalCount: items.length,
      sources: sources.size,
      sourcesList: [...sources].slice(0, 8),
      lastSignal: last,
      topCategory: top,
      categoryDist: dist.slice(0, 4),
      activity: 0,
    });
    max = Math.max(max, items.length);
  }
  for (const r of out) r.activity = Math.round((r.signalCount / max) * 100);
  out.sort((a, b) => b.signalCount - a.signalCount);
  return out;
}
