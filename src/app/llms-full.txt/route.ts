import { NextResponse } from "next/server";
import { buildLlmsFullTxt } from "@/lib/seoTools";

// llms-full.txt：llms.txt 的完整版，全量文章纯文本索引（按语种分组）。
// 与 llms.txt / atom.xml 一样用 route handler 实时生成，避免静态 public 文件
// 被 [locale] 动态段误吞而返回 500。
export const dynamic = "force-dynamic";

export async function GET() {
  const txt = buildLlmsFullTxt();
  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
