// 多语言配置：子目录路由策略（/zh /en /ja ...），每个语言版本独立 URL
export const locales = ["zh", "en", "ja", "ko", "es", "fr"] as const;
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
};

// 资讯分类（key 稳定，标签走字典）
export const categories = [
  "recommend",
  "world",
  "tech",
  "finance",
  "sports",
  "entertainment",
  "health",
  "science",
  "video",
] as const;
export type Category = (typeof categories)[number];

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export function isCategory(v: string): v is Category {
  return (categories as readonly string[]).includes(v);
}
