import Link from "next/link";
import { homeHref } from "@/lib/paths";

export default function NotFound() {
  return (
    <html lang="zh-CN">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          height: "100vh",
          margin: 0,
          background: "#f5f5f5",
          color: "#333",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#f04142", fontSize: 48, margin: 0 }}>404</h1>
          <p>页面不存在 / Page not found</p>
          <Link href={homeHref("zh")} style={{ color: "#f04142" }}>
            → 全球头条 / Global Headlines
          </Link>
        </div>
      </body>
    </html>
  );
}
