import { BRAND_PREFIX, BRAND_SUFFIX } from "@/lib/brand";

/**
 * starteday 品牌资产（server-safe，纯 SVG，无客户端 JS）
 *
 * BrandMark：日轮 + 地平线。底色由 .brand-mark 的 --brand-grad 提供，
 * 因此深浅主题自动适配，也避免多实例 SVG <defs> id 冲突。
 * BrandWordmark：start(常规) + eday(品牌色) + 日轮圆点；文本仍是完整
 * "starteday"，可被选中、复制、被屏幕阅读器正常读出（有利于 SEO）。
 */
export function BrandMark({
  size = 30,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="27" r="12" fill="currentColor" />
      <path d="M10 41h44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 50h28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`.trim()}>
      <span>{BRAND_PREFIX}</span>
      <span className="wm-accent">{BRAND_SUFFIX}</span>
      <span className="wm-dot" aria-hidden="true" />
    </span>
  );
}
