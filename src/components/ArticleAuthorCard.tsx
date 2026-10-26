import { Category, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import FollowButton from "./FollowButton";

const AV_COLORS: Record<string, string> = {
  recommend: "#ffb224",
  world: "#22d3ee",
  tech: "#6ea8fe",
  finance: "#3ddc97",
  sports: "#ff7a59",
  entertainment: "#c792ea",
  health: "#f06ea9",
  science: "#7ee787",
  video: "#ff5c8a",
};

// 今日头条式作者卡片：头像（来源首字母）+ 来源名 + 分类副标题 + 关注按钮。
// 服务端组件：无交互状态，避免 hydration。
export default function ArticleAuthorCard({
  source,
  category,
  locale,
}: {
  source: string;
  category: string;
  locale: Locale;
}) {
  const d = getDict(locale);
  const c = AV_COLORS[category] || "#ffb224";
  const initial = (source || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div className="art-author-card">
      <span className="aac-avatar" style={{ background: c }} aria-hidden>
        {initial}
      </span>
      <div className="aac-info">
        <span className="aac-name">{source}</span>
        <span className="aac-sub">{d.categories[category as Category] || category}</span>
      </div>
      <FollowButton source={source} locale={locale} />
    </div>
  );
}
