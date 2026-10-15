import Link from "next/link";
import { homeHref } from "@/lib/paths";

// 信号丢失页：噪声层 + 等宽遥测语汇（错误页是品牌体验的一部分）
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
                  color: "#ffb224",
                  border: "1px solid #ffb224",
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
          </div>
        </div>
      </body>
    </html>
  );
}
