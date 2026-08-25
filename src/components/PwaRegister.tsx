"use client";

import { useEffect } from "react";

// 注册 Service Worker（静态托管兼容）。失败时静默忽略，不影响页面。
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
