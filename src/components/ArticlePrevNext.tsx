import Link from "next/link";
import { Locale, Category, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticles } from "@/data/newsSource";
import { articleHref } from "@/lib/paths";

// 上一篇/下一篇：优先「同栏目」时间相邻（cov63 内链优化——原先按全站时间取邻居，
// 权重常传给不相关栏目；改为同栏目后内链主题更聚焦、抓取聚类更清晰）。
// 同栏目不足 2 篇时退回全站邻居，保证区块不消失。
// 服务端组件，force-static 构建期求值；只把两篇邻居标题下发，不带全量数据。
export default async function ArticlePrevNext({
  locale,
  currentId,
  category,
}: {
  locale: Locale;
  currentId: string;
  category?: Category;
}) {
  const d = getDict(locale);
  let pool = await getArticles(locale);
  if (!pool.some((a) => a.id === currentId)) {
    const cats = categories.filter((c) => c !== "recommend" && c !== "video");
    const extra = (await Promise.all(cats.map((c) => getArticles(locale, c)))).flat();
    pool = [...pool, ...extra];
  }
  const inCat = category
    ? pool.filter((a) => a.category === category && a.media !== "video")
    : [];
  const scoped = inCat.some((a) => a.id === currentId) && inCat.length >= 2 ? inCat : pool;
  const sorted = [...scoped].sort((a, b) => b.publishedAt - a.publishedAt);
  const idx = sorted.findIndex((a) => a.id === currentId);
  if (idx < 0) return null;
  const newer = idx > 0 ? sorted[idx - 1] : null; // 时间更近
  const older = idx < sorted.length - 1 ? sorted[idx + 1] : null; // 时间更早
  if (!newer && !older) return null;
  return (
    <nav className="art-prevnext" aria-label="prev-next">
      {older ? (
        <Link className="apn-item" href={articleHref(locale, older.id)} rel="prev">
          <span className="apn-dir">&#8592; {d.apnPrev}</span>
          <span className="apn-title">{older.title}</span>
        </Link>
      ) : (
        <span className="apn-item empty" />
      )}
      {newer ? (
        <Link className="apn-item next" href={articleHref(locale, newer.id)} rel="next">
          <span className="apn-dir">{d.apnNext} &#8594;</span>
          <span className="apn-title">{newer.title}</span>
        </Link>
      ) : (
        <span className="apn-item empty" />
      )}
    </nav>
  );
}
