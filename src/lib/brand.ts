/**
 * starteday · 品牌单一真相源 (BRAND SYSTEM v1)
 *
 * 所有组件、元数据、静态资源里的品牌名都从这里取，避免 8 语种字典、
 * 内联文案、SVG 资产各自硬编码造成漂移。
 * 品牌名全小写、跨语言不翻译；各语种只本地化 tagline / 描述。
 */
export const BRAND_NAME = "starteday" as const;
export const BRAND_PREFIX = "start";
export const BRAND_SUFFIX = "eday";
export const BRAND_TAGLINE_EN = "Start your day, informed";

/** 与 globals.css 中的 --brand-* 保持一致，供 SVG / OG 图 / PWA 清单复用 */
export const BRAND_COLORS = {
  sunrise: "#ff9248",
  solid: "#ea5f22",
  ember: "#f0512a",
  gold: "#ffb347",
  ink: "#0a0e14",
} as const;
