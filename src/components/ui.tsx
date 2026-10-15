import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from "react";

// 信号台基础组件库 v1（P3 沉淀）：终端语汇三件套。
// 全站新组件优先使用；旧组件保持既有类名，逐步迁移。

type Variant = "primary" | "solid" | "dim";

export function SdButton({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const cls = ["sd-btn", "sd-btn-" + variant, className].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}

export function SdChip({
  active = false,
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { active?: boolean }) {
  const cls = ["sd-chip", active ? "on" : "", className].filter(Boolean).join(" ");
  return <span className={cls} {...rest} />;
}

export function SdInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const cls = ["sd-input", className].filter(Boolean).join(" ");
  return <input className={cls} {...rest} />;
}
