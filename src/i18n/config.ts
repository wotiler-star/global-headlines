// 多语言配置：子目录路由策略（/zh /en /ja ...），每个语言版本独立 URL
export const locales = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";

export const localeMeta: Record<
  Locale,
  { name: string; englishName: string; dir: "ltr" | "rtl"; hreflang: string }
> = {
  zh: { name: "中文", englishName: "Chinese", dir: "ltr", hreflang: "zh-CN" },
  en: { name: "English", englishName: "English", dir: "ltr", hreflang: "en-US" },
  ja: { name: "日本語", englishName: "Japanese", dir: "ltr", hreflang: "ja-JP" },
  ko: { name: "한국어", englishName: "Korean", dir: "ltr", hreflang: "ko-KR" },
  es: { name: "Español", englishName: "Spanish", dir: "ltr", hreflang: "es-ES" },
  fr: { name: "Français", englishName: "French", dir: "ltr", hreflang: "fr-FR" },
  pt: { name: "Português", englishName: "Portuguese", dir: "ltr", hreflang: "pt-PT" },
  tr: { name: "Türkçe", englishName: "Turkish", dir: "ltr", hreflang: "tr-TR" },
};

// SEO：每个语言的地区化 hreflang 变体。同一个 URL 面向多个国家/地区声明，
// 让 Google 在特定国家搜索结果里优先展示对应语言版本（如 es-MX → /es/、pt-BR → /pt/）。
// 注意：hreflang 键必须全局唯一，且每个键只指向一个 URL，否则会被搜索引擎判为冲突。
export const localeRegions: Record<Locale, string[]> = {
  zh: ["zh-CN", "zh-Hans", "zh-TW", "zh-HK", "zh-Hant", "zh-SG", "zh-MO"],
  en: ["en-US", "en-GB", "en-AU", "en-CA", "en-NZ", "en-IE", "en-IN", "en-SG", "en-PH", "en-ZA", "en-NG", "en-KE", "en-GH", "en-PK", "en-MY", "en-HK"],
  ja: ["ja-JP"],
  ko: ["ko-KR"],
  es: ["es-ES", "es-MX", "es-AR", "es-CO", "es-CL", "es-PE", "es-VE", "es-EC", "es-UY", "es-PY", "es-BO", "es-CR", "es-PA", "es-DO", "es-GT", "es-HN", "es-NI", "es-SV", "es-CU"],
  fr: ["fr-FR", "fr-CA", "fr-BE", "fr-CH", "fr-LU", "fr-MC", "fr-SN", "fr-CI", "fr-CM", "fr-MA", "fr-DZ", "fr-TN", "fr-MG"],
  pt: ["pt-PT", "pt-BR", "pt-AO", "pt-MZ", "pt-GW", "pt-CV", "pt-ST", "pt-TL"],
  tr: ["tr-TR", "tr-CY"],
};

// OG 使用的 locale 格式（下划线，如 zh_CN），Open Graph 协议要求
export const ogLocale: Record<Locale, string> = {
  zh: "zh_CN", en: "en_US", ja: "ja_JP", ko: "ko_KR",
  es: "es_ES", fr: "fr_FR", pt: "pt_PT", tr: "tr_TR",
};

// 资讯分类（key 稳定，标签走字典）
export const categories = [
  "recommend",
  "world",
  "tech",
  "finance",
  "crossborder",
  "sports",
  "entertainment",
  "game",
  "health",
  "science",
  "culture",
  "video",
] as const;
export type Category = (typeof categories)[number];

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export function isCategory(v: string): v is Category {
  return (categories as readonly string[]).includes(v);
}
