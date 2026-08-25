"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { Article } from "@/data/news";
import { videoEmbedSrc } from "@/lib/video";
import { articleHref } from "@/lib/paths";
import Link from "next/link";

type Ctx = { open: (a: Article) => void; setFeed: (a: Article[]) => void };
const VideoModalCtx = createContext<Ctx | null>(null);

// 安全获取：若外层没有 Provider（理论上不会，已在 layout 包裹），返回 noop，
// NewsCard 据此回退为正常跳转。
export function useVideoModal(): Ctx | null {
  return useContext(VideoModalCtx);
}

function embedSrc(a: Article): string | null {
  if (a.media !== "video" || !a.videoPlatform || !a.videoId) return null;
  return videoEmbedSrc(a.videoPlatform, a.videoId);
}

// 视频浮层 Provider：包裹整站（layout 内），任意视频卡片点击即打开浮层播放，
// 不离开当前信息流页面（对标头条「点视频直接在信息流内起播」的体验）。
// 同时持有首页信息流列表，用于浮层内「相关视频」横条。
export default function VideoModalProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<Article | null>(null);
  const [feed, setFeed] = useState<Article[]>([]);
  const open = useCallback((a: Article) => setCurrent(a), []);
  const close = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [current, close]);

  return (
    <VideoModalCtx.Provider value={{ open, setFeed }}>
      {children}
      {current && (
        <VideoModalInner
          article={current}
          feed={feed}
          onClose={close}
          onSelect={setCurrent}
          locale={locale}
        />
      )}
    </VideoModalCtx.Provider>
  );
}

function VideoModalInner({
  article,
  feed,
  onClose,
  onSelect,
  locale,
}: {
  article: Article;
  feed: Article[];
  onClose: () => void;
  onSelect: (a: Article) => void;
  locale: Locale;
}) {
  const d = getDict(locale);
  const src = embedSrc(article);

  // 相关视频：同分类优先，再补其他分类，最多 6 条（对标头条浮层「相关视频」）
  const related = useMemo(() => {
    const vids = feed.filter((a) => a.media === "video" && a.id !== article.id);
    const sameCat = vids.filter((a) => a.category === article.category);
    const rest = vids.filter((a) => a.category !== article.category);
    return [...sameCat, ...rest].slice(0, 6);
  }, [feed, article]);

  return (
    <div className="vm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vm-panel" onClick={(e) => e.stopPropagation()}>
        <button className="vm-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="vm-player">
          {src ? (
            <iframe
              src={src}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            // 无可用嵌入源时退化为大图 + 播放角标
            <div className="vm-fallback">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.images[0]} alt={article.title} />
              <span className="play-badge" aria-hidden>
                ▶
              </span>
            </div>
          )}
        </div>
        <div className="vm-info">
          <h3 className="vm-title">{article.title}</h3>
          <div className="vm-meta">
            <span className="src">{article.source}</span>
            <span>{article.readMinutes} min</span>
            <Link href={articleHref(locale, article.id)} className="vm-open" onClick={onClose}>
              {d.readMore} →
            </Link>
          </div>
          <p className="vm-summary">{article.summary}</p>
        </div>
        {related.length > 0 && (
          <div className="vm-related">
            <div className="vm-related-title">{d.relatedVideos}</div>
            <div className="vm-related-row">
              {related.map((v) => (
                <button
                  key={v.id}
                  className="vm-rel-card"
                  onClick={() => onSelect(v)}
                  title={v.title}
                >
                  <div className="vm-rel-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.images[0]} alt={v.title} loading="lazy" />
                    <span className="play-badge sm" aria-hidden>
                      ▶
                    </span>
                  </div>
                  <span className="vm-rel-name">{v.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
