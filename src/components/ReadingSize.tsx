"use client";
import { useEffect, useState } from "react";
import { SdButton } from "./ui";

const KEY = "gh_read_size";
const SIZES = ["s", "m", "l"] as const;
type Size = (typeof SIZES)[number];

// 正文字号调节：切换 <html data-reading>，CSS 分级缩放 .article-body。
export default function ReadingSize() {
  const [size, setSize] = useState<Size>("m");
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t && (SIZES as readonly string[]).includes(t)) setSize(t as Size);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-reading", size);
    try {
      localStorage.setItem(KEY, size);
    } catch {}
  }, [size]);
  return (
    <div className="read-size" role="group" aria-label="正文字号">
      <span className="rs-label">Aa</span>
      {SIZES.map((s) => (
        <SdButton
          key={s}
          type="button"
          variant={size === s ? "primary" : "dim"}
          onClick={() => setSize(s)}
          aria-pressed={size === s}
          aria-label={"字号 " + (s === "s" ? "小" : s === "l" ? "大" : "标准")}
        >
          {s === "s" ? "A-" : s === "l" ? "A+" : "A"}
        </SdButton>
      ))}
    </div>
  );
}
