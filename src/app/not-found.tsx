import Link from "next/link";
import { homeHref } from "@/lib/paths";

// 信号丢失页：噪声层 + 等宽遥测语汇 + starteday 品牌落款
// （错误页也是品牌触点，独立 <html> 不继承 [locale] 布局，故全部用内联样式）
export default function NotFound() {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          background: "#0a0e14",
          color: "#e8eef5",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ position: "relative", textAlign: "center", maxWidth: 520 }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05 }} aria-hidden="true">
            <filter id="nf-noise">
              <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#nf-noise)" />
          </svg>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
              <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                <rect width="64" height="64" rx="14" fill="#ea5f22" />
                <circle cx="32" cy="27" r="12" fill="#ffffff" />
                <path d="M10 41h44" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
                <path d="M18 50h28" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
              </svg>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
                <span style={{ color: "#e8eef5" }}>start</span>
                <span style={{ color: "#ff9248" }}>eday</span>
              </span>
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.24em",
                color: "#ff5c5c",
                marginBottom: 12,
              }}
            >
              ERROR 404 // SIGNAL LOST
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "0.02em", marginBottom: 10 }}>信号丢失</div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: "#93a4b8",
                lineHeight: 1.8,
                marginBottom: 22,
              }}
            >
              请求的资源不在信号范围内
              <br />
              链接可能已失效或内容已归档
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Link
                href={homeHref("zh")}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "#ff9248",
                  border: "1px solid #ff9248",
                  borderRadius: 4,
                  padding: "8px 18px",
                  textDecoration: "none",
                }}
              >
                [ 重新扫描 ]
              </Link>
              <Link
                href={homeHref("zh")}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  color: "#93a4b8",
                  border: "1px solid #1e2836",
                  borderRadius: 4,
                  padding: "8px 18px",
                  textDecoration: "none",
                }}
              >
                [ 返回控制台 ]
              </Link>
            </div>
            <div
              style={{
                marginTop: 30,
                fontSize: 11,
                letterSpacing: "0.16em",
                color: "#75839a",
              }}
            >
              starteday · 从这里，开始每一天
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
