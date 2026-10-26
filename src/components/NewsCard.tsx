"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article, formatRelativeTime } from "@/data/news";
import { articleHref } from "@/lib/paths";
import { useVideoModal } from "./VideoModal";
import BookmarkButton from "./BookmarkButton";
import { ViewCountBadge } from "./ViewCounts";

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

function NewsCardImpl({
  article,
  query,
  priority = false,
}: {
  article: Article;
  query?: string;
  priority?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 悬停预取：鼠标停留 ~120ms 才预取该卡片文章页（避免快速划过时大批无谓预取），离开即取消。
  // 注意：不能靠 <Link prefetch={hovered}> 的 false→true 翻转——Next 14 App Router 的视口预取
  // effect 不会因该 prop 变化重新触发（实测 hover 前后无 _rsc 请求）。这里用 router.prefetch()
  // 显式触发，命中 router 缓存后导航秒开。
  const router = useRouter();
  const hoverTimer = useRef<number | undefined>(undefined);
  const onCardEnter = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => router.prefetch(href), 120);
  };
  const onCardLeave = () => {
    window.clearTimeout(hoverTimer.current);
  };
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
    <article className="card feed-card" onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
      <div className="fc-body">
        <Link prefetch={false} href={href} className="fc-title-link" onClick={onVideoClick}>
          <h2 className="card-title">{highlight(article.title, query)}</h2>
        </Link>
        <div className="card-meta">
          <span className="src">{article.source}</span>
          <span>{mounted ? formatRelativeTime(article.locale, article.publishedAt, d) : (article.timeAgo ?? "")}</span>
          <ViewCountBadge articleId={article.id} />
          {isVideo && <span className="media-tag">{d.videoLabel}</span>}
          <span className="tag">{d.categories[article.category]}</span>
        </div>
        {three && (
          <div className="card-imgs c3">
            {article.images.map((src, i) => (
              <Link prefetch={false} href={href} key={i} onClick={onVideoClick}>
                <div className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={article.title} {...(i === 0 ? imgProps : { loading: "lazy" as const, decoding: "async" as const })} />
                  {i === 0 && <BookmarkButton id={article.id} category={article.category} className="bm-on-card" />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {!three && (
        <Link prefetch={false} href={href} className="fc-thumb" onClick={onVideoClick}>
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.cover || article.images[0]} alt={article.title} {...imgProps} />
              {isVideo && <span className="play-badge" aria-hidden>▶</span>}
              <BookmarkButton id={article.id} category={article.category} className="bm-on-card" />
            </div>
        </Link>
      )}
    </article>
  );
}

// memo：信息流长列表中，父组件（分类切换 / 搜索过滤 / 滚动加载）重渲染时，
// 只要 article / query / priority 不变，卡片跳过重渲染，降低客户端渲染开销。
const NewsCard = memo(NewsCardImpl);
export default NewsCard;
