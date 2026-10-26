"use client";

import { useEffect, useMemo, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { formatRelativeTime } from "@/data/news";
import { useAuth } from "@/lib/auth-client";
import { useCommentLikes } from "@/lib/personal";

type Cmt = {
  id: number;
  articleId: string;
  userId: number | null;
  authorName: string;
  body: string;
  createdAt: number;
  parentId?: number | null;
  likes?: number;
  likedByMe?: boolean;
};

// 头像底色：按昵称确定性取色（同一昵称永远同色）
const AVATAR_COLORS = ["#6ea8fe", "#3ddc97", "#ffb224", "#ff7a59", "#c792ea", "#f06ea9", "#22d3ee", "#7ee787"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initial(name: string): string {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

const PAGE_SIZE = 10;

// 文章页评论区（对标今日头条）：头像 + 昵称 + 时间 + 正文 + 点赞/回复 + 最热/最新排序 + 一级回复。
// SSR 首帧 list=null（客户端拉取），点赞态挂载后读 localStorage，均避免水合错位。
export default function CommentSection({
  locale,
  articleId,
  category,
}: {
  locale: Locale;
  articleId: string;
  category: string;
}) {
  const d = getDict(locale);
  const { user } = useAuth();
  const { has: liked, toggle: toggleLike } = useCommentLikes();
  const [list, setList] = useState<Cmt[] | null>(null);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    fetch(`/api/comments?articleId=${encodeURIComponent(articleId)}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j) => { setList(Array.isArray(j.comments) ? j.comments : []); })
      .catch(() => { setList([]); });
  };
  useEffect(() => { let alive = true; fetch(`/api/comments?articleId=${encodeURIComponent(articleId)}`).then(r=>r.ok?r.json():{comments:[]}).then(j=>{if(alive)setList(Array.isArray(j.comments)?j.comments:[])}).catch(()=>{if(alive)setList([])}); return () => { alive = false; }; }, [articleId]);

  // 点赞双轨：登录用户走服务端 toggle（计数权威，跨设备同步）；游客保持本地点赞态
  const likeCount = (c: Cmt) => (user ? c.likes || 0 : (c.likes || 0) + (liked(c.id) ? 1 : 0));
  const isLiked = (c: Cmt) => (user ? !!c.likedByMe : liked(c.id));
  const onLike = (c: Cmt) => {
    if (user) {
      setList((prev) =>
        (prev || []).map((x) =>
          x.id === c.id
            ? { ...x, likedByMe: !x.likedByMe, likes: Math.max(0, (x.likes || 0) + (x.likedByMe ? -1 : 1)) }
            : x
        )
      );
      fetch(`/api/comments/${c.id}/like`, { method: "POST" })
        .then((r) => r.json())
        .then((j) => {
          if (j && j.ok) {
            setList((prev) => (prev || []).map((x) => (x.id === c.id ? { ...x, likedByMe: j.liked, likes: j.count } : x)));
          }
        })
        .catch(() => {});
    } else {
      toggleLike(c.id);
    }
  };
  // 点击昵称：向主输入框插入 @昵称（触发被提及用户的消息通知）
  const mention = (name: string) => {
    const tag = "@" + name + " ";
    setBody((b) => (b.includes(tag) ? b : (b ? b.trimEnd() + " " : "") + tag));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, body: text, authorName: author.trim() || undefined, category }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setBody("");
        setFlash(d.commentSent);
        if (j.comment) setList((prev) => [...(prev || []), j.comment as Cmt]);
        window.setTimeout(() => setFlash(""), 2500);
      } else {
        setFlash(j.error || "failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (parentId: number) => {
    const text = replyBody.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, body: text, authorName: author.trim() || undefined, category, parentId }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.comment) {
        setList((prev) => [...(prev || []), j.comment as Cmt]);
        setReplyTo(null);
        setReplyBody("");
      } else {
        setFlash(j.error || "failed");
      }
    } finally {
      setBusy(false);
    }
  };

  // 顶层评论 + 回复分组
  const { roots, repliesOf } = useMemo(() => {
    const all = list || [];
    const byParent = new Map<number, Cmt[]>();
    const roots: Cmt[] = [];
    for (const c of all) {
      const pid = c.parentId ?? null;
      if (pid) {
        const arr = byParent.get(pid) || [];
        arr.push(c);
        byParent.set(pid, arr);
      } else {
        roots.push(c);
      }
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
    const now = Date.now();
    // 最热：本地点赞优先 > 回复数 > 新近度；最新：时间倒序
    const score = (c: Cmt) => ((user ? !!c.likedByMe : liked(c.id)) ? 100 : 0) + (byParent.get(c.id)?.length || 0) * 10 + 1 / (1 + (now - c.createdAt) / 86400000);
    roots.sort((a, b) => (sort === "hot" ? score(b) - score(a) : b.createdAt - a.createdAt));
    return { roots, repliesOf: (id: number) => byParent.get(id) || [] };
  }, [list, sort, user, liked]);

  const shown = expanded ? roots : roots.slice(0, PAGE_SIZE);

  return (
    <section className="comments">
      <div className="comments-head">
        <h3 className="comments-title">
          {d.commentsTitle}
          {list ? <span className="comments-count">({list.length})</span> : null}
        </h3>
        <div className="comments-sort" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={sort === "hot"}
            className={`cs-tab${sort === "hot" ? " active" : ""}`}
            onClick={() => setSort("hot")}
          >
            {d.cmHot}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "new"}
            className={`cs-tab${sort === "new" ? " active" : ""}`}
            onClick={() => setSort("new")}
          >
            {d.cmNew}
          </button>
        </div>
      </div>
      <form className="comment-form" onSubmit={submit}>
        {!user && (
          <input
            className="comment-author"
            type="text"
            placeholder={d.commentNamePh}
            value={author}
            maxLength={24}
            onChange={(e) => setAuthor(e.target.value)}
          />
        )}
        <textarea
          className="comment-input"
          placeholder={d.commentPh}
          value={body}
          maxLength={1000}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="comment-form-foot">
          <span className="comment-hint">{user ? d.authHi(user.username) : d.commentGuestHint}</span>
          <button className="btn btn-primary comment-submit" type="submit" disabled={busy || !body.trim()}>
            {busy ? "…" : d.commentSubmit}
          </button>
        </div>
        {flash && <div className="comment-flash">{flash}</div>}
      </form>
      <ul className="comment-list">
        {shown.map((c) => {
          const replies = repliesOf(c.id);
          return (
            <li key={c.id} className="comment-item">
              <span className="cm-avatar" style={{ background: avatarColor(c.authorName) }} aria-hidden>
                {initial(c.authorName)}
              </span>
              <div className="cm-main">
                <div className="cm-meta">
                  <button type="button" className="cm-name cm-mention" title={`@${c.authorName}`} onClick={() => mention(c.authorName)}>
                    {c.authorName}
                  </button>
                  <span className="cm-time">{formatRelativeTime(locale, c.createdAt, d)}</span>
                </div>
                <div className="cm-text">{c.body}</div>
                <div className="cm-actions">
                  <button
                    type="button"
                    className={`cm-act like${isLiked(c) ? " on" : ""}`}
                    aria-pressed={isLiked(c)}
                    onClick={() => onLike(c)}
                  >
                    <span aria-hidden>👍</span>
                    {likeCount(c)}
                  </button>
                  <button
                    type="button"
                    className="cm-act"
                    onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyBody(""); }}
                  >
                    <span aria-hidden>💬</span>
                    {d.cmReply}
                  </button>
                </div>
                {replyTo === c.id && (
                  <div className="cm-reply-box">
                    <textarea
                      className="cm-reply-input"
                      rows={2}
                      maxLength={500}
                      placeholder={d.cmReplyPh}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    <div className="cm-reply-foot">
                      <button type="button" className="cm-reply-cancel" onClick={() => setReplyTo(null)}>
                        {d.cmCancel}
                      </button>
                      <button
                        type="button"
                        className="cm-reply-ok"
                        disabled={busy || !replyBody.trim()}
                        onClick={() => submitReply(c.id)}
                      >
                        {busy ? "…" : d.cmReply}
                      </button>
                    </div>
                  </div>
                )}
                {replies.map((r) => (
                  <div key={r.id} className="cm-reply-item">
                    <span className="cm-avatar sm" style={{ background: avatarColor(r.authorName) }} aria-hidden>
                      {initial(r.authorName)}
                    </span>
                    <div className="cm-main">
                      <div className="cm-meta">
                        <button type="button" className="cm-name cm-mention" title={`@${r.authorName}`} onClick={() => mention(r.authorName)}>
                          {r.authorName}
                        </button>
                        <span className="cm-time">{formatRelativeTime(locale, r.createdAt, d)}</span>
                      </div>
                      <div className="cm-text">{r.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
        {list && list.length === 0 && <li className="comment-empty">{d.memberNoComments}</li>}
      </ul>
      {!expanded && roots.length > PAGE_SIZE && (
        <button type="button" className="cm-more" onClick={() => setExpanded(true)}>
          {d.cmMoreComments}
        </button>
      )}
    </section>
  );
}
