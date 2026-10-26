import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
const UPLOAD_DIR = "/app/data/uploads";
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file: any = form ? form.get("file") : null;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "无效文件" }, { status: 400 });
  }
  const type = file.type as string;
  if (!ALLOWED[type]) return NextResponse.json({ error: "仅支持 JPG/PNG/GIF/WebP" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  const ext = ALLOWED[type];
  const name = Date.now().toString(36) + randomBytes(6).toString("hex") + "." + ext;
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return NextResponse.json({ ok: true, url: "/api/media/" + name });
}
