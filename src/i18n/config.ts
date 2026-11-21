// 多语言配置：子目录路由策略（/zh /en /ja ...），每个语言版本独立 URL
// zh = 简体中文（默认，沿用无后缀文章 id），zh-Hant = 繁體中文（文章 id 带 -zh-Hant 后缀）
export const locales = ["zh", "zh-Hant", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "tr", "ru", "uk", "ar", "hi", "id", "ms", "fil", "vi", "th", "my", "bn", "ur"] as const;

// 新增语种若暂未提供专属 UI 翻译，克隆 en 作为回退（文章内容单独产出）。
export const NEW_LOCALES = ["ms", "fil", "vi", "th", "my", "bn", "ur"] as const;
export type NewLocale = (typeof NEW_LOCALES)[number];

// 繁体中文：由简体文案经 opencc 预生成静态字面量（见 src/i18n/zhHant/），
// 不属于 NEW_LOCALES（不回退英文），需在各 Raw 字典中作为必填键显式提供。
export const ZH_HANT_LOCALE = "zh-Hant" as const;
export type ZhHantLocale = (typeof ZH_HANT_LOCALE)[number];

// Raw 字典需要显式提供的语种键：全部语种去掉「回退英文」组（zh-Hant 必须显式提供）。
export type RawLocale = Exclude<Locale, NewLocale>;

// 把已翻译语种的字典/配置克隆到新语种（取 en 内容），避免逐个文件重复大量行。
// 支持对象（深一层浅拷贝）、数组、原始值三种类型。
export function withEnFallback<T>(base: Record<RawLocale, T>): Record<Locale, T> {
  const out = { ...base } as Record<Locale, T>;
  const src = base.en as unknown;
  for (const l of NEW_LOCALES) {
    let val: T;
    if (Array.isArray(src)) val = [...(src as readonly T[])] as T;
    else if (typeof src === "object" && src !== null) val = { ...(src as object) } as T;
    else val = src as T;
    out[l] = val;
  }
  return out;
}
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";

export const localeMeta: Record<
  Locale,
  { name: string; englishName: string; dir: "ltr" | "rtl"; hreflang: string }
> = {
  zh: { name: "简体中文", englishName: "Simplified Chinese", dir: "ltr", hreflang: "zh-CN" },
  "zh-Hant": { name: "繁體中文", englishName: "Traditional Chinese", dir: "ltr", hreflang: "zh-Hant" },
  en: { name: "English", englishName: "English", dir: "ltr", hreflang: "en-US" },
  ja: { name: "日本語", englishName: "Japanese", dir: "ltr", hreflang: "ja-JP" },
  ko: { name: "한국어", englishName: "Korean", dir: "ltr", hreflang: "ko-KR" },
  es: { name: "Español", englishName: "Spanish", dir: "ltr", hreflang: "es-ES" },
  fr: { name: "Français", englishName: "French", dir: "ltr", hreflang: "fr-FR" },
  de: { name: "Deutsch", englishName: "German", dir: "ltr", hreflang: "de-DE" },
  it: { name: "Italiano", englishName: "Italian", dir: "ltr", hreflang: "it-IT" },
  pt: { name: "Português", englishName: "Portuguese", dir: "ltr", hreflang: "pt-PT" },
  tr: { name: "Türkçe", englishName: "Turkish", dir: "ltr", hreflang: "tr-TR" },
  ru: { name: "Русский", englishName: "Russian", dir: "ltr", hreflang: "ru-RU" },
  uk: { name: "Українська", englishName: "Ukrainian", dir: "ltr", hreflang: "uk-UA" },
  ar: { name: "العربية", englishName: "Arabic", dir: "rtl", hreflang: "ar" },
  hi: { name: "हिन्दी", englishName: "Hindi", dir: "ltr", hreflang: "hi-IN" },
  id: { name: "Bahasa Indonesia", englishName: "Indonesian", dir: "ltr", hreflang: "id-ID" },
  ms: { name: "Bahasa Melayu", englishName: "Malay", dir: "ltr", hreflang: "ms-MY" },
  fil: { name: "Filipino", englishName: "Filipino", dir: "ltr", hreflang: "fil-PH" },
  vi: { name: "Tiếng Việt", englishName: "Vietnamese", dir: "ltr", hreflang: "vi-VN" },
  th: { name: "ไทย", englishName: "Thai", dir: "ltr", hreflang: "th-TH" },
  my: { name: "မြန်မာ", englishName: "Burmese", dir: "ltr", hreflang: "my-MM" },
  bn: { name: "বাংলা", englishName: "Bengali", dir: "ltr", hreflang: "bn-BD" },
  ur: { name: "اردو", englishName: "Urdu", dir: "rtl", hreflang: "ur-PK" },
};

// SEO：每个语言的地区化 hreflang 变体。同一个 URL 面向多个国家/地区声明，
// 让 Google 在特定国家搜索结果里优先展示对应语言版本（如 es-MX → /es/、pt-BR → /pt/）。
// 注意：hreflang 键必须全局唯一，且每个键只指向一个 URL，否则会被搜索引擎判为冲突。
export const localeRegions: Record<Locale, string[]> = {
  // 简体中文页：只声明简体/中国大陆及新加坡、马来西亚等简体使用地区。
  zh: ["zh-CN", "zh-Hans", "zh-SG"],
  // 繁體中文页：声明繁体文字标签及港澳台等繁体使用地区（与简体页互斥，避免 hreflang 冲突）。
  "zh-Hant": ["zh-Hant", "zh-TW", "zh-HK", "zh-MO"],
  // 注：en-PK/en-MY/en-PH/en-IN 已移除——PK/BD/MY/PH/IN 已有专属语种页（ur/bn/ms/fil/hi），
  // 由对应语种页声明 ur-PK/bn-BD/ms-MY/fil-PH/hi-IN 承接，避免英语页与专属语种页抢同一国家定位。
  en: ["en-US", "en-GB", "en-AU", "en-CA", "en-NZ", "en-IE", "en-SG", "en-ZA", "en-NG", "en-KE", "en-GH", "en-HK"],
  ja: ["ja-JP"],
  ko: ["ko-KR"],
  es: ["es-ES", "es-MX", "es-AR", "es-CO", "es-CL", "es-PE", "es-VE", "es-EC", "es-UY", "es-PY", "es-BO", "es-CR", "es-PA", "es-DO", "es-GT", "es-HN", "es-NI", "es-SV", "es-CU"],
  fr: ["fr-FR", "fr-CA", "fr-BE", "fr-CH", "fr-LU", "fr-MC", "fr-SN", "fr-CI", "fr-CM", "fr-MA", "fr-DZ", "fr-TN", "fr-MG"],
  de: ["de-DE", "de-AT", "de-CH", "de-LU", "de-BE", "de-LI"],
  it: ["it-IT", "it-CH", "it-SM", "it-VA"],
  pt: ["pt-PT", "pt-BR", "pt-AO", "pt-MZ", "pt-GW", "pt-CV", "pt-ST", "pt-TL"],
  tr: ["tr-TR", "tr-CY"],
  ru: ["ru-RU", "ru-BY", "ru-KZ", "ru-KG", "ru-TJ", "ru-TM"],
  uk: ["uk-UA"],
  ar: ["ar", "ar-SA", "ar-EG", "ar-AE", "ar-MA", "ar-DZ", "ar-TN", "ar-LY", "ar-JO", "ar-SY", "ar-IQ", "ar-KW", "ar-QA", "ar-BH", "ar-OM", "ar-LB", "ar-YE", "ar-PS", "ar-SD", "ar-MR"],
  hi: ["hi-IN"],
  id: ["id-ID"],
  ms: ["ms-MY"],
  fil: ["fil-PH"],
  vi: ["vi-VN"],
  th: ["th-TH"],
  my: ["my-MM"],
  bn: ["bn-BD", "bn-IN"],
  ur: ["ur-PK", "ur-IN"],
};

// OG 使用的 locale 格式（下划线，如 zh_CN），Open Graph 协议要求
export const ogLocale: Record<Locale, string> = {
  zh: "zh_CN", "zh-Hant": "zh_TW", en: "en_US", ja: "ja_JP", ko: "ko_KR",
  es: "es_ES", fr: "fr_FR", de: "de_DE", it: "it_IT", pt: "pt_PT", tr: "tr_TR",
  ru: "ru_RU", uk: "uk_UA", ar: "ar_AR", hi: "hi_IN", id: "id_ID",
  ms: "ms_MY", fil: "fil_PH", vi: "vi_VN", th: "th_TH", my: "my_MM",
  bn: "bn_BD", ur: "ur_PK",
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

// 不建静态栏目页、也不进导航的栏目（内容为空，建页会形成 thin/soft-404 空壳页）。
// sports 全站 0 篇：保留 category 枚举（历史文章/数据兼容），但停止建页与导航露出。
// 若将来真正开始产体育内容，把 "sports" 从本列表移除即可自动恢复栏目页。
export const NO_CATEGORY_PAGE: readonly Category[] = ["sports"];
export function hasCategoryPage(c: Category): boolean {
  return !NO_CATEGORY_PAGE.includes(c);
}

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export function isCategory(v: string): v is Category {
  return (categories as readonly string[]).includes(v);
}
