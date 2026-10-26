"use client";

import { useAuth } from "@/lib/auth-client";

/** 需要登录的页面上的登录按钮：登录成功后回跳到指定路径 */
export default function LoginEntryButton({ next, label }: { next: string; label: string }) {
  const { openLogin } = useAuth();
  return (
    <button type="button" className="btn btn-primary" onClick={() => openLogin(next)}>
      {label}
    </button>
  );
}
