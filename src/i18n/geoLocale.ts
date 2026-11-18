import { Locale, isLocale } from "./config";

// ---------------------------------------------------------------------------
// 国家/地区 → 界面语种映射（ISO 3166-1 alpha-2，大写）
//
// 设计原则：
//  1) 官方/通用语言优先；多官方语言国家取覆盖人口最多或国际通用度最高的语种。
//  2) 站点仅支持 8 个语种，未覆盖地区回落到 en（国际通用语），不强塞中文。
//  3) 只用于「首次访客建议语种」；用户手动选择（cookie）与显式 /xx/ URL 永远优先。
//  4) 站点无国家专属内容，所以同一语种下所有地区共享同一 URL，地区差异仅体现在
//     hreflang 地区变体（config.ts localeRegions）与自动切换建议。
// ---------------------------------------------------------------------------

const GROUPS: { codes: string; locale: Locale }[] = [
  { codes: "CN TW HK MO SG", locale: "zh" },
  { codes: "JP", locale: "ja" },
  { codes: "KR", locale: "ko" },
  { codes: "ES MX AR CO CL PE VE EC UY PY BO CR PA DO GT HN NI SV CU PR GQ", locale: "es" },
  // 法语欧洲 + 法语非洲/印度洋 + 马格里布（法语通用）
  { codes: "FR BE LU MC SN CI ML BF NE TD CG CD CM CF GA GN BJ TG MG KM DJ RW BI SC MU MA DZ TN", locale: "fr" },
  { codes: "PT BR AO MZ GW CV ST TL", locale: "pt" },
  { codes: "TR", locale: "tr" },
  // 英语官方/通用语国家
  { codes: "US GB AU CA NZ IE ZA NG KE GH UG TZ ZM ZW BW NA MW SS SD ET ER SO IN PK BD LK NP MY PH FJ PG SB VU JM TT BB BS BZ GY LC GD VC AG KN DM MT AE QA KW BH OM SA JO LB IL", locale: "en" },
];

// 德语/意语/荷语/北欧/东欧/中亚/东南亚非英语国家：站点暂不支持 → 回落 en。
// 显式说明以免后续误以为漏配；兜底逻辑见 countryToLocale。

const COUNTRY_LOCALE: Record<string, Locale> = {};
for (const g of GROUPS) {
  for (const c of g.codes.split(/\s+/)) {
    if (!c) continue;
    if (COUNTRY_LOCALE[c] && COUNTRY_LOCALE[c] !== g.locale) {
      // 同码冲突时保留先声明者（前面组更具体）
      continue;
    }
    COUNTRY_LOCALE[c] = g.locale;
  }
}

/** 国家码 → 建议语种；未知国家回落 en（国际通用语） */
export function countryToLocale(country?: string | null): Locale {
  const c = (country || "").trim().toUpperCase();
  return COUNTRY_LOCALE[c] || "en";
}

/**
 * Accept-Language 解析（带 q 权重、地区回退）。
 * 例："fr-CA,fr;q=0.9,en;q=0.8" → fr；"de-DE,de;q=0.9" → undefined（不支持德语）。
 */
export function acceptLanguageToLocale(header?: string | null): Locale | undefined {
  if (!header) return undefined;
  const scored: { lang: string; q: number }[] = [];
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    let q = 1;
    for (const p of params) {
      const m = /q\s*=\s*([0-9.]+)/i.exec(p);
      if (m) q = Math.min(1, Math.max(0, Number(m[1]) || 0));
    }
    if (tag) scored.push({ lang: tag.toLowerCase(), q });
  }
  scored.sort((a, b) => b.q - a.q);
  for (const { lang, q } of scored) {
    if (q <= 0) continue;
    const base = lang.split("-")[0];
    if (isLocale(base)) return base;
  }
  return undefined;
}

/** 国家码 → 该地区显示用的 BCP47 标签，用于前端提示文案 */
export function countryToDisplayLocale(country?: string | null): string {
  const c = (country || "").trim().toUpperCase();
  const loc = countryToLocale(c);
  const map: Record<string, string> = {
    BR: "pt-BR", PT: "pt-PT", MX: "es-MX", ES: "es-ES", AR: "es-AR",
    GB: "en-GB", AU: "en-AU", CA: "en-CA", IN: "en-IN", US: "en-US",
    TW: "zh-TW", HK: "zh-HK", SG: "zh-SG", CN: "zh-CN",
    FR: "fr-FR", BE: "fr-BE", JP: "ja-JP", KR: "ko-KR", TR: "tr-TR",
  };
  return map[c] || loc;
}

/** 供验证/调试：已显式配置的国家数 */
export const SUPPORTED_COUNTRY_COUNT = Object.keys(COUNTRY_LOCALE).length;
