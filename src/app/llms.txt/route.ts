import { NextResponse } from "next/server";
import { buildLlmsTxt } from "@/lib/seoTools";

// llms.txt（https://llmstxt.org/）：给 AI 搜索 / 爬虫一份简明站点与最新内容索引。
// 同样用 route handler 实时生成，避免静态 public 文件被 [locale] 段误吞（500）。
export const dynamic = "force-dynamic";

export async function GET() {
  const txt = buildLlmsTxt();
  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
