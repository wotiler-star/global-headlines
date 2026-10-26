import Link from "next/link";
import { Locale, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getArticles } from "@/data/newsSource";
import { articleHref } from "@/lib/paths";

// 上一篇/下一篇：同语言文章池（首页流 + 各分类补充）按发布时间倒序取当前篇的邻居。
// 服务端组件，force-static 构建期求值；只把两篇邻居标题下发，不带全量数据。
export default async function ArticlePrevNext({
  locale,
  currentId,
}: {
  locale: Locale;
  currentId: string;
}) {
  const d = getDict(locale);
  let pool = await getArticles(locale);
  if (!pool.some((a) => a.id === currentId)) {
    const cats = categories.filter((c) => c !== "recommend" && c !== "video");
    const extra = (await Promise.all(cats.map((c) => getArticles(locale, c)))).flat();
    pool = [...pool, ...extra];
  }
  const sorted = [...pool].sort((a, b) => b.publishedAt - a.publishedAt);
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
