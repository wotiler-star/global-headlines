import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article, formatRelativeTime } from "@/data/news";
import { articleHref } from "@/lib/paths";
import { useVideoModal } from "./VideoModal";
import BookmarkButton from "./BookmarkButton";
import FollowButton from "./FollowButton";

// 高亮搜索词：把文本里匹配 query 的片段包成 <mark>。大小写不敏感，支持多词（空格分隔）。
function highlight(text: string, query?: string) {
  const q = query?.trim();
  if (!q) return text;
  const terms = q.split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  const lowerTerms = terms.map((t) => t.toLowerCase());
  const parts = text.split(re);
  return parts.map((part, i) =>
    lowerTerms.includes(part.toLowerCase()) ? (
      <mark key={i}>{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function NewsCard({
  article,
  query,
  priority = false,
}: {
  article: Article;
  query?: string;
  priority?: boolean;
}) {
  const d = getDict(article.locale);
  const href = articleHref(article.locale, article.id);
  const isVideo = article.media === "video";
  const three = article.imageCount === 3;
  const vm = useVideoModal();

  // 首屏第一张卡片的图是 LCP 候选：用 eager + 高优先级，避免 lazy 拖慢首屏；
  // 其余卡片保持 lazy + async 解码。
  const imgProps = priority
    ? ({ loading: "eager" as const, fetchPriority: "high" as const })
    : ({ loading: "lazy" as const, decoding: "async" as const });

  // 视频卡：点击在信息流内直接起播浮层（对标头条），而非跳转详情页。
  const onVideoClick = isVideo && vm
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        vm.open(article);
      }
    : undefined;

  return (
    <article className="card feed-card">
      <div className="fc-body">
        <Link href={href} className="fc-title-link" onClick={onVideoClick}>
          <h2 className="card-title">{highlight(article.title, query)}</h2>
        </Link>
        <div className="card-meta">
          <span className="src">{article.source}</span>
          <FollowButton source={article.source} locale={article.locale} className="follow-on-card" />
          <span>{formatRelativeTime(article.locale, article.publishedAt, d)}</span>
          <span>{article.readMinutes} min</span>
          {isVideo && <span className="media-tag">{d.videoLabel}</span>}
          <span className="tag">{d.categories[article.category]}</span>
        </div>
        {three && (
          <div className="card-imgs c3">
            {article.images.map((src, i) => (
              <Link href={href} key={i} onClick={onVideoClick}>
                <div className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={article.title} {...(i === 0 ? imgProps : { loading: "lazy" as const, decoding: "async" as const })} />
                  {i === 0 && <BookmarkButton id={article.id} className="bm-on-card" />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {!three && (
        <Link href={href} className="fc-thumb" onClick={onVideoClick}>
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.images[0]} alt={article.title} {...imgProps} />
              {isVideo && <span className="play-badge" aria-hidden>▶</span>}
              <BookmarkButton id={article.id} className="bm-on-card" />
            </div>
        </Link>
      )}
    </article>
  );
}
