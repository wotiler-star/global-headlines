import { ReactNode } from "react";

// 根布局只做透传：<html> 由 [locale]/layout 按语言渲染（i18n 官方模式）
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
