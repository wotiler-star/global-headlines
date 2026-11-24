import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// GEO：主流 AI 搜索 / 生成式引擎的抓取器显式声明为允许抓取。
// 关键：每个专属 UA 段都必须重复 disallow /api/ —— robots 按「最具体的
// User-agent 段」匹配，只写 allow 会让这些爬虫躲过 * 段的 /api/ 限制。
// 内容与配图许可见 /llms.txt 与各语种 /about 页。
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "YouBot",
  "meta-externalagent",
  "Diffbot",
  "Amazonbot",
  "AI2Bot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_AGENTS,
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: "*",
        allow: "/",
        // 会员/后台页用页面级 noindex，不能在这里 disallow，
        // 否则 Googlebot 抓不到页面也就读不到 noindex 标记。
        disallow: ["/api/"],
      },
    ],
    // 三个 sitemap 并列声明：
    // - sitemap.xml：全量 URL（23 语种首页 + 全部文章）
    // - news-sitemap.xml：Google 新闻专用（最近 48h），route handler 实时生成
    // - image-sitemap.xml：Google 图片搜索专用（每篇文章的真实配图），route handler 实时生成
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/news-sitemap.xml`,
      `${SITE_URL}/image-sitemap.xml`,
    ],
  };
}
