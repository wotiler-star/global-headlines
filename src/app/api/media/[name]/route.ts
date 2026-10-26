import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
const UPLOAD_DIR = "/app/data/uploads";
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return new NextResponse("bad name", { status: 400 });
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (!TYPES[ext]) return new NextResponse("bad type", { status: 400 });
  const fp = path.join(UPLOAD_DIR, name);
  if (!fp.startsWith(UPLOAD_DIR) || !existsSync(fp)) return new NextResponse("not found", { status: 404 });
  const buf = readFileSync(fp);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": TYPES[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
