import Link from "next/link";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

// 稳定的「热度值」：基于 id 生成 30万~999万 之间的固定数字，仅用于展示排行热度。
function hotValue(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = 30 + (Math.abs(h) % 970); // 30 ~ 999（万）
  return n >= 100 ? `${n}万` : `${n}万`;
}

// 热榜 (hot board) rail — 头条热榜风格：排名色 + 右侧热度值。
export default function HotBoard({ locale, items }: { locale: Locale; items: Article[] }) {
  if (items.length === 0) return null;
  const d = getDict(locale);
  return (
    <div className="panel hot-board">
      <h3>
        <span className="bar" />
        {d.hotTitle}
      </h3>
      {items.map((a, i) => (
        <div className="trending-item" key={a.id}>
          <span className={`rank r${Math.min(i + 1, 4)}`}>{i + 1}</span>
          <Link href={articleHref(a.locale, a.id)} className="t-title">{a.title}</Link>
          <span className="hot-val">{hotValue(a.id)}</span>
        </div>
      ))}
    </div>
  );
}
