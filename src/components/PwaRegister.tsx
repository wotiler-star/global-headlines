"use client";

import { useEffect } from "react";

// cov16：彻底关闭 Service Worker。
// 实测（30 次无 SW 对照 = 0 次 #418；任何 SW 配置均有 10%~25% 概率触发 React #418，
// args=[HTML,""]）证明 SW 的存在本身就会破坏 Next.js App Router 的水合。
// 即便改为「导航/_next 直走网络 + 移除 clients.claim」的纯透传 SW 仍偶发，故直接停用。
// 这里主动 unregister 已注册过的旧 SW（清理回访用户的浏览器），且不再注册新的。
// 代价：失去离线壳缓存（站点为实时新闻站，影响可忽略）。
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const r of regs) r.unregister().catch(() => {});
        })
        .catch(() => {});
    }
  }, []);
  return null;
}
