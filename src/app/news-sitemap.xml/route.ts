import { NextResponse } from "next/server";
import { buildNewsSitemap } from "@/lib/seoTools";

// Google News 站点地图：请求时实时读取 volume 里的 articles.json（最近 48h）。
// 用 route handler 而非静态 public 文件——Next 生产态不会提供运行期新写入的 public/ 资源，
// 且静态文件会被 [locale] 动态段误吞导致 500。
export const dynamic = "force-dynamic";

export async function GET() {
  const xml = buildNewsSitemap();
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
