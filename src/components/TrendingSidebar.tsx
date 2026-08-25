import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

export default function TrendingSidebar({ articles }: { articles: Article[] }) {
  const d = getDict(articles[0]?.locale ?? "zh");
  return (
    <aside className="sidebar">
      <div className="panel">
        <h3>
          <span className="bar" />
          {d.trendingTitle}
        </h3>
        {articles.map((a, i) => (
          <div className="trending-item" key={a.id}>
            <span className="rank">{i + 1}</span>
            <Link href={articleHref(a.locale, a.id)}>{a.title}</Link>
          </div>
        ))}
      </div>
    </aside>
  );
}
