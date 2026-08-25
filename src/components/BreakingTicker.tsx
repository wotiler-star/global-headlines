import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

// 首页突发新闻滚动条：横向跑马灯，取自热搜 top 条目。服务端渲染，纯 CSS 动画。
export default function BreakingTicker({ articles }: { articles: Article[] }) {
  const d = getDict(articles[0]?.locale ?? "zh");
  if (articles.length === 0) return null;
  const items = articles.slice(0, 12);
  // 复制一份以实现无缝循环
  const loop = [...items, ...items];
  return (
    <div className="breaking" aria-label={d.breakingTitle}>
      <span className="breaking-tag">{d.breakingTitle}</span>
      <div className="breaking-track-wrap">
        <div className="breaking-track">
          {loop.map((a, i) => (
            <Link key={`${a.id}-${i}`} href={articleHref(a.locale, a.id)} className="breaking-item">
              {a.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
