import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

export default function RelatedPanel({
  articles,
  title,
}: {
  articles: Article[];
  title?: string;
}) {
  const d = getDict(articles[0]?.locale ?? "zh");
  if (articles.length === 0) return null;
  return (
    <section>
      <div className="section-title">
        <span className="bar" />
        {title ?? d.relatedTitle}
      </div>
      <div className="related-grid">
        {articles.map((a) => (
          <Link key={a.id} href={articleHref(a.locale, a.id)} className="related-card">
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.images[0]} alt={a.title} loading="lazy" />
            </div>
            <div className="rc-title">{a.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
