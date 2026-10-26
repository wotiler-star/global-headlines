import Link from "next/link";
import { Locale, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { categoryHref } from "@/lib/paths";
import NewsCard from "./NewsCard";

// 首页「板块」：把信息流按分类聚成分区（科技/财经/体育…），每区标题 + 若干卡片 + 查看全部。
export default function SectionedFeed({
  locale,
  articles,
}: {
  locale: Locale;
  articles: Article[];
}) {
  const d = getDict(locale);
  const sections = categories
    .filter((c) => c !== "recommend")
    .map((c) => ({
      cat: c,
      items: articles.filter((a) => a.category === c).slice(0, 4),
    }))
    .filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return <div className="empty">{d.notFoundDesc}</div>;
  }

  return (
    <div className="home-sections">
      {sections.map((s) => (
        <section className="home-section" key={s.cat}>
          <div className="home-section-head">
            <h2>
              <span className="bar" />
              {d.categories[s.cat]}
            </h2>
            <Link href={categoryHref(locale, s.cat)} className="hs-more">
              {d.viewAll} →
            </Link>
          </div>
          <div className="home-section-grid">
            {s.items.map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
