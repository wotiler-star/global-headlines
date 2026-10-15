"use client";
import { useEffect, useRef } from "react";

const POOL = "全球头条信号遥测网络快讯深度扫描解码锁定接收中0123456789";

// 解码揭示：SSR 渲染终题（SEO/无 JS 无损），挂载后逐字乱码滚动再定格。
// prefers-reduced-motion 时直接显示，不动一笔。
export default function DecodeTitle({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const timer = setInterval(() => {
      const out = text
        .split("")
        .map((c, idx) => (idx < i ? c : POOL[Math.floor(Math.random() * POOL.length)]))
        .join("");
      el.textContent = out;
      i += 0.6;
      if (i >= text.length) {
        clearInterval(timer);
        el.textContent = text;
      }
    }, 45);
    return () => clearInterval(timer);
  }, [text]);
  return (
    <h1 ref={ref} className={className}>
      {text}
    </h1>
  );
}
