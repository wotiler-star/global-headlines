import Link from "next/link";
import type { Locale, Category } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { Article } from "@/data/news";
import { articleHref, categoryHref } from "@/lib/paths";

// cov63 内链优化：文章页「同栏目更多」内链块。
// RelatedPanel 按内容相似度跨栏目取稿（语义是「相关」）；这里补一层确定性的
// 「同栏目」内链，把权重显式传回所属栏目页 + 同栏目文章，形成
// 文章 → 栏目 / 文章 → 同栏目文章 的双向链路，缩短抓取深度、强化主题聚类。
// 服务端组件，构建期求值；纯文本链接列表不带图片，几乎不增加 HTML 体积。
export default function MoreInCategory({
  locale,
  category,
  articles,
}: {
  locale: Locale;
  category: Category;
  articles: Article[];
}) {
  if (articles.length === 0) return null;
  const d = getDict(locale);
  const catName = d.categories[category];
  return (
    <nav className="more-in-cat" aria-label={catName}>
      <div className="mic-label">MORE IN · {catName}</div>
      <ul className="mic-list">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={articleHref(locale, a.id)}>{a.title}</Link>
          </li>
        ))}
      </ul>
      <Link href={categoryHref(locale, category)} className="mic-all">
        {d.viewAll} {catName} →
      </Link>
    </nav>
  );
}
