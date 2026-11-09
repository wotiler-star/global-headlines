import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 会员/后台页用页面级 noindex，不能在这里 disallow，
        // 否则 Googlebot 抓不到页面也就读不到 noindex 标记。
        disallow: ["/api/"],
      },
    ],
    // 全量 URL（8 语种首页 + 全部文章）与 Google 新闻专用（最近 48h）并列声明。
    // news-sitemap.xml 由 scripts/gen-news-sitemap.mjs 在容器内生成到 public/。
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
