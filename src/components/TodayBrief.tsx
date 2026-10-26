import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { articleHref } from "@/lib/paths";

// 今日头条式「今日要闻」卡：日期 + 要闻标题列表（数据取热榜 top N）。
// 服务端组件：日期在构建/ISR 再生期生成，随 revalidate=60 刷新，无水合风险。
export default function TodayBrief({ locale, items }: { locale: Locale; items: Article[] }) {
  if (!items.length) return null;
  const d = getDict(locale);
  const now = new Date();
  const y = now.getFullYear();
  const mth = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const tag = locale === "zh" ? "zh-CN" : locale;
  const wk = new Intl.DateTimeFormat(tag, { weekday: "long" }).format(now);
  return (
    <section className="today-brief">
      <div className="tb-head">
        <span className="tb-tag">{d.todayBrief}</span>
        <span className="tb-date">{y}.{mth}.{day} {wk}</span>
      </div>
      <ul className="tb-list">
        {items.slice(0, 5).map((a) => (
          <li key={a.id}>
            <Link href={articleHref(locale, a.id)}>{a.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
