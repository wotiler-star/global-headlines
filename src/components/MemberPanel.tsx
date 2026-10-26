"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth-client";

type MeUser = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  created_at: number;
  points: number;
  balance: number;
  avatar: string | null;
  bio: string | null;
};

type MeData = {
  user: MeUser | null;
  counts: { articles: number; drafts: number; comments: number; bookmarks: number; follows: number };
  unread: number;
  ad: { impressions: number; clicks: number; revenue: number };
  ledger: { id: number; delta: number; reason: string; ref: string | null; createdAt: number }[];
};

type MyArt = {
  id: string;
  locale: string;
  category: string;
  title: string;
  summary: string | null;
  source: string | null;
  publishedAt: number;
  tags: string[];
  status: string;
  pinned: number;
  deleted: number;
  reviewNote?: string | null;
  cover?: string | null;
};

type Msg = { id: number; type: string; title: string; body: string | null; read: number; created_at: number };

type MyCmt = { id: number; article_id: string; author_name: string; body: string; created_at: number };

type Tab = "overview" | "articles" | "comments" | "messages" | "points" | "profile";

const REASON: Record<string, Record<string, string>> = {
  publish: { zh: "发文奖励", en: "Publish reward", ja: "公開報酬", ko: "발행 보상", es: "Recompensa", fr: "Publication" },
  checkin: { zh: "每日签到", en: "Daily check-in", ja: "デイリーチェックイン", ko: "출석 체크", es: "Registro diario", fr: "Check-in" },
  comment: { zh: "评论奖励", en: "Comment reward", ja: "コメント報酬", ko: "댓글 보상", es: "Recompensa por comentario", fr: "Récompense commentaire" },
  view: { zh: "阅读量奖励", en: "View reward", ja: "閲覧報酬", ko: "조회 보상", es: "Recompensa por lectura", fr: "Récompense de lecture" },
};

const TYPE_ICON: Record<string, string> = { comment: "💬", reward: "🎁", system: "📢", mention: "📣" };

// 表情头像预设（点击即设，存为 1-2 字符）
const AVATARS = ["😀","😄","😁","😆","😊","😇","🙂","😉","😍","🥰","😘","😎","🤩","🥳","🤖","👻","👽","🤡","🦊","🐯","🐼","🐨","🐵","🦁","🐸","🐧","🦄","🐉","🌟","🔥","💎","🏆","🚀","🎨","🎵","⚽","🏀"];

export default function MemberPanel({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const router = useRouter();
  const { user: authUser, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [me, setMe] = useState<MeData | null>(null);
  const [arts, setArts] = useState<MyArt[] | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [cmts, setCmts] = useState<MyCmt[] | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});

  const flash = (m: string) => {
    setFlashMsg(m);
    window.setTimeout(() => setFlashMsg(""), 2500);
  };

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/me");
    if (r.ok) {
      const j = (await r.json()) as MeData;
      setMe(j);
      if (j.user) {
        setAvatar(j.user.avatar || "");
        setBio(j.user.bio || "");
      }
    }
  }, []);

  const loadArts = useCallback(async () => {
    const r = await fetch("/api/me/articles");
    if (r.ok) {
      const items = ((await r.json()).items || []) as MyArt[];
      setArts(items);
      // 我的稿件：批量取真实阅读量
      const ids = items.map((a) => a.id).slice(0, 100).join(",");
      if (ids) {
        fetch(`/api/views/bulk?ids=${encodeURIComponent(ids)}`)
          .then((rr) => (rr.ok ? rr.json() : null))
          .then((j) => {
            if (j && j.counts) setViewCounts(j.counts as Record<string, number>);
          })
          .catch(() => {});
      }
    }
  }, []);

  const loadMsgs = useCallback(async () => {
    const r = await fetch("/api/me/messages");
    if (r.ok) setMsgs(((await r.json()).items || []) as Msg[]);
  }, []);

  const loadCmts = useCallback(async () => {
    const r = await fetch("/api/me/comments");
    if (r.ok) setCmts(((await r.json()).items || []) as MyCmt[]);
  }, []);

  useEffect(() => {
    if (ready && authUser) {
      loadMe();
      loadArts();
      loadMsgs();
      loadCmts();
    }
  }, [ready, authUser, loadMe, loadArts, loadMsgs, loadCmts]);

  const ago = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return d.agoJustNow;
    if (s < 3600) return d.agoMinutes(Math.floor(s / 60));
    if (s < 86400) return d.agoHours(Math.floor(s / 3600));
    return d.agoDays(Math.floor(s / 86400));
  };

  const reasonText = (r: string) => (REASON[r] && REASON[r][locale]) || r;

  const checkin = async () => {
    const r = await fetch("/api/me/checkin", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) flash(j.error || "failed");
    else {
      flash("+5 ✓");
      loadMe();
      loadMsgs();
    }
  };

  const delArt = async (id: string) => {
    if (!window.confirm(d.memberConfirmDelete)) return;
    const r = await fetch(`/api/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) {
      flash(d.adminDelete + " ✓");
      loadArts();
      loadMe();
    } else flash("failed");
  };

  const restoreArt = async (id: string) => {
    const r = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (r.ok) {
      flash(d.memberRestore + " ✓");
      loadArts();
      loadMe();
    } else flash("failed");
  };

  const delCmt = async (id: number) => {
    if (!window.confirm(d.memberConfirmDelete)) return;
    const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (r.ok) {
      flash(d.adminDelete + " ✓");
      loadCmts();
      loadMe();
    } else flash("failed");
  };

  const markRead = async (all: boolean, id?: number) => {
    await fetch("/api/me/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all ? { all: true } : { id }),
    });
    loadMsgs();
    loadMe();
  };

  const withdraw = async () => {
    const r = await fetch("/api/me/withdraw", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    flash(r.ok ? `✓ ${j.withdrawn}` : j.error || "failed");
    if (r.ok) {
      loadMe();
      loadMsgs();
    }
  };

  const saveProfile = async () => {
    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar, bio }),
    });
    flash(r.ok ? d.adminSave + " ✓" : "failed");
    if (r.ok) loadMe();
  };

  const changePassword = async () => {
    if (newPw.length < 6) { flash(d.memberPwShort); return; }
    if (newPw !== confirmPw) { flash(d.authPwMismatch); return; }
    setPwBusy(true);
    const r = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    const j = await r.json().catch(() => ({}));
    setPwBusy(false);
    if (r.ok) {
      flash(d.memberPwChanged);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      flash(j.code === "too_short" ? d.memberPwShort : j.code === "wrong_old" ? d.memberPwWrong : "failed");
    }
  };

  if (!ready) return <div className="member"><p className="member-muted">{d.loadingMore}</p></div>;
  if (!authUser) {
    return (
      <div className="member">
        <div className="admin-guard">
          <h1>{d.memberCenter}</h1>
          <p>{d.memberNeedLogin}</p>
          <button className="btn" onClick={() => router.push(`/${locale}`)}>
            {d.adminBackToSite}
          </button>
        </div>
      </div>
    );
  }

  const tabs: { k: Tab; label: string; badge?: number }[] = [
    { k: "overview", label: d.memberOverview },
    { k: "articles", label: d.memberMyArticles },
    { k: "comments", label: d.memberMyComments },
    { k: "messages", label: d.memberMessages, badge: me?.unread || 0 },
    { k: "points", label: d.memberPoints },
    { k: "profile", label: d.memberProfile },
  ];

  return (
    <div className="member">
      <div className="member-head">
        <div className="member-head-id">
          <div className="member-avatar">{me?.user?.avatar || "头"}</div>
          <div>
            <h1>{d.memberCenter}</h1>
            <div className="member-sub">
              {d.authHi(authUser.username)} · {d.memberPointsBalance}: <b>{me?.user?.points ?? 0}</b>
            </div>
          </div>
        </div>
        <div className="member-head-actions">
          <button className="btn" onClick={checkin}>
            {d.memberCheckin} +5
          </button>
          <button className="btn btn-primary" onClick={() => router.push(`/${locale}/write`)}>
            {d.memberWriteNew}
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.k}
            className={"admin-tab" + (tab === t.k ? " active" : "")}
            onClick={() => setTab(t.k)}
          >
            {t.label}
            {t.badge ? <span className="member-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {flashMsg && <div className="admin-msg">{flashMsg}</div>}

      {tab === "overview" && me && (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <div className="admin-stat-v">{me.user?.points ?? 0}</div>
              <div className="admin-stat-l">{d.memberPointsBalance}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.user?.balance ?? 0}</div>
              <div className="admin-stat-l">{d.memberAdRevenue}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.counts.articles}</div>
              <div className="admin-stat-l">{d.memberPublished}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.counts.drafts}</div>
              <div className="admin-stat-l">{d.memberDraft}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.counts.comments}</div>
              <div className="admin-stat-l">{d.adminComments}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.counts.bookmarks}</div>
              <div className="admin-stat-l">{d.memberBookmarks}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.counts.follows}</div>
              <div className="admin-stat-l">{d.memberFollows}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.ad.impressions}</div>
              <div className="admin-stat-l">曝光</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-v">{me.ad.clicks}</div>
              <div className="admin-stat-l">点击</div>
            </div>
          </div>
          <div className="member-actions">
            <button className="btn" onClick={withdraw}>
              {d.memberWithdraw}
            </button>
            <span className="member-muted">{d.memberAdRevenue}: {me.ad.revenue}</span>
          </div>
        </>
      )}

      {tab === "articles" && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={showTrash}
                onChange={(e) => setShowTrash(e.target.checked)}
              />
              {d.memberShowTrash}
            </label>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{d.memberMyArticles}</th>
                <th>{d.adminStatus}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(arts || [])
                .filter((a) => (showTrash ? true : !a.deleted))
                .map((a) => (
                  <tr key={a.id} className={a.deleted ? "row-del" : ""}>
                    <td>
                      <div className="art-title">{a.title}</div>
                      <div className="art-meta">
                        {a.locale} · {a.category} · {ago(a.publishedAt)}
                        {a.status === "draft" ? " · 📝" : ""}
                        {a.pinned ? " · 📌" : ""}
                        {a.deleted ? " · 🗑" : ""}
                        {a.status === "rejected" && a.reviewNote ? " · ⚠ " + a.reviewNote : ""}
                        {viewCounts[a.id] ? ` · 🔥 ${viewCounts[a.id]}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={"status-pill " + (a.deleted ? "trash" : a.status === "draft" ? "draft" : a.status === "published" ? "published" : a.status === "rejected" ? "rejected" : "pending")}>
                        {a.deleted ? d.memberTrash : a.status === "draft" ? d.memberDraft : a.status === "published" ? d.memberPublished : a.status === "rejected" ? d.reviewRejected : d.reviewPending}
                      </span>
                    </td>
                    <td className="admin-actions">
                      {a.deleted ? (
                        <button className="btn-sm" onClick={() => restoreArt(a.id)}>
                          {d.memberRestore}
                        </button>
                      ) : (
                        <>
                          {!a.deleted && (
                            <button className="btn-sm" onClick={() => router.push(`/${locale}/article/${a.id}`)}>
                              {d.memberViewArticle}
                            </button>
                          )}
                          <button className="btn-sm" onClick={() => router.push(`/${locale}/write/${a.id}`)}>
                            {d.memberEditArticle}
                          </button>
                          <button className="btn-sm danger" onClick={() => delArt(a.id)}>
                            {d.memberDeleteArticle}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              {(!arts || arts.filter((a) => (showTrash ? true : !a.deleted)).length === 0) && (
                <tr>
                  <td colSpan={3} className="admin-empty">
                    {showTrash ? d.memberTrash + " · " + d.adminNoResult : d.memberNoArticles}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "comments" && (
        <div className="admin-section">
          <div className="member-msgs">
            {(cmts || []).map((c) => (
              <div key={c.id} className="member-msg">
                <div className="member-msg-head">
                  <b>{c.author_name}</b>
                  <span>{ago(c.created_at)}</span>
                </div>
                <div className="member-msg-body">{c.body}</div>
                <div className="member-msg-foot">
                  <Link href={`/${locale}/article/${c.article_id}`} className="member-msg-link">
                    {d.memberViewArticle}
                  </Link>
                  <button className="btn-sm danger" onClick={() => delCmt(c.id)}>
                    {d.adminDelete}
                  </button>
                </div>
              </div>
            ))}
            {(!cmts || cmts.length === 0) && <div className="admin-empty">{d.memberNoComments}</div>}
          </div>
        </div>
      )}

      {tab === "messages" && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <button className="btn" onClick={() => markRead(true)}>
              {d.memberMarkAllRead}
            </button>
          </div>
          <div className="member-msgs">
            {(msgs || []).map((m) => (
              <div
                key={m.id}
                className={"member-msg" + (m.read ? "" : " unread")}
                onClick={() => !m.read && markRead(false, m.id)}
              >
                <div className="member-msg-head">
                  <b>
                    {TYPE_ICON[m.type] || "📢"} {m.title}
                  </b>
                  <span>{ago(m.created_at)}</span>
                </div>
                {m.body && <div className="member-msg-body">{m.body}</div>}
              </div>
            ))}
            {(!msgs || msgs.length === 0) && <div className="admin-empty">{d.memberNoMessages}</div>}
          </div>
        </div>
      )}

      {tab === "points" && me && (
        <div className="admin-section">
          <div className="member-points-head">
            <div className="member-points-balance">{me.user?.points ?? 0}</div>
            <div className="member-muted">{d.memberPointsBalance}</div>
          </div>
          <div className="member-rules">
            <h3 className="member-h3">{d.memberPointsRules}</h3>
            <ul>
              <li>📝 {d.pointsRulePublish}</li>
              <li>📅 {d.pointsRuleCheckin}</li>
              <li>💬 {d.pointsRuleComment}</li>
              <li>🔥 {d.pointsRuleViews}</li>
            </ul>
          </div>
          <h3 className="member-h3">{d.memberPointsLog}</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{d.memberPointsLog}</th>
                <th>{d.memberPoints}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {me.ledger.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="art-title">{reasonText(r.reason)}</div>
                    <div className="art-meta">{ago(r.createdAt)}</div>
                  </td>
                  <td style={{ color: r.delta >= 0 ? "var(--live)" : "#ff5c5c" }}>
                    {r.delta >= 0 ? "+" : ""}
                    {r.delta}
                  </td>
                  <td className="member-muted">{r.ref || "-"}</td>
                </tr>
              ))}
              {me.ledger.length === 0 && (
                <tr>
                  <td colSpan={3} className="admin-empty">
                    {d.adminNoResult}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "profile" && (
        <div className="admin-section member-profile">
          <label className="member-field">
            <span>{d.authUsername}</span>
            <input value={authUser.username} disabled />
          </label>
          <label className="member-field">
            <span>{d.authEmailOptional}</span>
            <input value={me?.user?.email || ""} disabled />
          </label>
          <div className="member-field">
            <span>{d.memberAvatar}</span>
            <div className="avatar-picker">
              {AVATARS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={"avatar-opt" + (avatar === e ? " on" : "")}
                  onClick={() => setAvatar(avatar === e ? "" : e)}
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
            {avatar ? (
              <button type="button" className="btn btn-ghost avatar-clear" onClick={() => setAvatar("")}>
                {d.memberAvatarClear}
              </button>
            ) : null}
          </div>
          <label className="member-field">
            <span>{d.memberBioPh}</span>
            <textarea value={bio} maxLength={200} rows={3} onChange={(e) => setBio(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={saveProfile}>
            {d.adminSave}
          </button>

          <div className="member-changepw">
            <span>{d.memberChangePw}</span>
            <input type="password" autoComplete="current-password" placeholder={d.memberOldPw} value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            <input type="password" autoComplete="new-password" placeholder={d.memberNewPw} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <input type="password" autoComplete="new-password" placeholder={d.authPwConfirm} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            <button className="btn" onClick={changePassword} disabled={pwBusy}>
              {pwBusy ? "…" : d.memberChangePw}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
