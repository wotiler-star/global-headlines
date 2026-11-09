import { existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

// 社交分享图的单一真相源。
// scripts/gen-og-images.py 会把每个原创封面的 1200×630 JPG 写到 public/og/<slug>.jpg：
//   - 1.91:1 是 OG / Twitter 大卡的标准比例（原封面是 3:2，平台会二次裁切）；
//   - JPG 比 webp 在 WhatsApp / LinkedIn / 部分客户端的抓取兼容性更稳。
// 这里做 existsSync 兜底：新增批次若还没跑生成脚本，自动回退到原 webp 封面，
// 保证 metadata 永远不会指向 404。
export type OgImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
  type: string;
};

export function ogImageFor(cover: string | undefined, title: string): OgImage {
  const raw = cover || "";
  const m = /^\/original\/([^/]+)-cover\.webp$/.exec(raw);
  const slug = m?.[1];
  if (slug && existsSync(join(process.cwd(), "public", "og", `${slug}.jpg`))) {
    return {
      url: `${SITE_URL}/og/${slug}.jpg`,
      width: 1200,
      height: 630,
      alt: title,
      type: "image/jpeg",
    };
  }
  return {
    url: raw.startsWith("http") ? raw : `${SITE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`,
    width: 1200,
    height: 800,
    alt: title,
    type: "image/webp",
  };
}
