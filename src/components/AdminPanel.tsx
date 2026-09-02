"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

type Stats = {
  users: number;
  admins: number;
  articles: number;
  comments: number;
  bookmarks: number;
  follows: number;
  bannedUsers: number;
};

type ArtRow = {
  id: string;
  locale: string;
  category: string;
  title: string;
  source: string | null;
  published_at: number;
  pinned: number;
  deleted: number;
};

type CmtRow = {
  id: number;
  article_id: string;
  user_id: number | null;
  author_name: string;
  body: string;
  created_at: number;
  username: string | null;
};

type UsrRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  banned: number;
  created_at: number;
  bookmarks: number;
  comments: number;
};

type Tab = "overview" | "articles" | "comments" | "users";

export default function AdminPanel({ locale, username }: { locale: Locale; username: string }) {
  const d = getDict(locale);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const api = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, {
      method: opts?.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts?.body,
      credentials: "same-origin",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${txt}`);
    }
    return res.json();
  }, []);

  const [stats, setStats] = useState<Stats | null>(null);
  const [arts, setArts] = useState<ArtRow[]>([]);
  const [artQ, setArtQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cmts, setCmts] = useState<CmtRow[]>([]);
  const [usrs, setUsrs] = useState<UsrRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const loadStats = useCallback(async () => {
    try {
      setStats(await api("/api/admin/stats"));
    } catch (e) {
      flash(String(e));
    }
  }, [api]);

  const loadArts = useCallback(async () => {
    try {
      const sp = new URLSearchParams();
      if (artQ) sp.set("q", artQ);
      if (includeDeleted) sp.set("includeDeleted", "1");
      const r = await api(`/api/admin/articles?${sp.toString()}`);
      setArts(r.items || []);
    } catch (e) {
      flash(String(e));
    }
  }, [api, artQ, includeDeleted]);

  const loadCmts = useCallback(async () => {
    try {
      const r = await api("/api/admin/comments");
      setCmts(r.items || []);
    } catch (e) {
      flash(String(e));
    }
  }, [api]);

  const loadUsrs = useCallback(async () => {
    try {
      const r = await api("/api/admin/users");
      setUsrs(r.items || []);
    } catch (e) {
      flash(String(e));
    }
  }, [api]);

  useEffect(() => {
    if (tab === "overview") loadStats();
    if (tab === "articles") loadArts();
    if (tab === "comments") loadCmts();
    if (tab === "users") loadUsrs();
  }, [tab, loadStats, loadArts, loadCmts, loadUsrs]);

  const actArt = async (id: string, action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api("/api/admin/articles", {
        method: "POST",
        body: JSON.stringify({ id, action, ...extra }),
      });
      flash(d.adminSave + " ✓");
      loadArts();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
    }
  };

  const actCmt = async (id: number) => {
    setBusy(true);
    try {
      await api("/api/admin/comments", { method: "POST", body: JSON.stringify({ id, action: "delete" }) });
      flash(d.adminDelete + " ✓");
      loadCmts();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
    }
  };

  const actUsr = async (id: number, action: string) => {
    setBusy(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify({ id, action }) });
      flash(d.adminSave + " ✓");
      loadUsrs();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { k: "overview" as Tab, label: d.adminOverview },
    { k: "articles" as Tab, label: d.adminArticles },
    { k: "comments" as Tab, label: d.adminComments },
    { k: "users" as Tab, label: d.adminUsers },
  ];

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>{d.adminTitle}</h1>
        <div className="admin-head-right">
          <span className="admin-user">{d.authHi(username)}</span>
          <button className="btn-ghost" onClick={() => router.push(`/${locale}`)}>
            {d.adminBackToSite}
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
          </button>
        ))}
      </div>

      {msg && <div className="admin-msg">{msg}</div>}
      {busy && <div className="admin-msg">{d.adminSave}…</div>}

      {tab === "overview" && stats && (
        <div className="admin-stats">
          <Stat label={d.adminStatsUsers} value={stats.users} />
          <Stat label={d.adminStatsAdmins} value={stats.admins} />
          <Stat label={d.adminStatsArticles} value={stats.articles} />
          <Stat label={d.adminStatsComments} value={stats.comments} />
          <Stat label={d.adminStatsBookmarks} value={stats.bookmarks} />
          <Stat label={d.adminStatsFollows} value={stats.follows} />
          <Stat label={d.adminStatsBanned} value={stats.bannedUsers} />
        </div>
      )}

      {tab === "articles" && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder={d.adminSearch}
              value={artQ}
              onChange={(e) => setArtQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadArts()}
            />
            <button className="btn" onClick={loadArts}>
              {d.adminSearch}
            </button>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              {d.adminRestore}
            </label>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{d.adminArticles}</th>
                <th>{d.adminRole}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {arts.map((a) => (
                <tr key={a.id} className={a.deleted ? "row-del" : ""}>
                  <td>
                    <div className="art-title">{a.title}</div>
                    <div className="art-meta">
                      {a.locale} · {a.category} · {a.source || "-"}
                      {a.pinned ? " · 📌" : ""}
                      {a.deleted ? " · 🗑" : ""}
                    </div>
                  </td>
                  <td>{a.category}</td>
                  <td className="admin-actions">
                    {a.pinned ? (
                      <button className="btn-sm" onClick={() => actArt(a.id, "unpin")}>
                        {d.adminUnpin}
                      </button>
                    ) : (
                      <button className="btn-sm" onClick={() => actArt(a.id, "pin")}>
                        {d.adminPin}
                      </button>
                    )}
                    {a.deleted ? (
                      <button className="btn-sm" onClick={() => actArt(a.id, "restore")}>
                        {d.adminRestore}
                      </button>
                    ) : (
                      <button className="btn-sm danger" onClick={() => actArt(a.id, "delete")}>
                        {d.adminDelete}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {arts.length === 0 && (
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

      {tab === "comments" && (
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{d.adminComments}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cmts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="art-title">
                      {c.author_name}
                      {c.username ? ` (@${c.username})` : " (guest)"} · {c.article_id}
                    </div>
                    <div className="art-meta">{c.body}</div>
                  </td>
                  <td className="admin-actions">
                    <button className="btn-sm danger" onClick={() => actCmt(c.id)}>
                      {d.adminDelete}
                    </button>
                  </td>
                </tr>
              ))}
              {cmts.length === 0 && (
                <tr>
                  <td colSpan={2} className="admin-empty">
                    {d.adminNoResult}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "users" && (
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{d.adminUsers}</th>
                <th>{d.adminRole}</th>
                <th>{d.adminBanned}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usrs.map((u) => (
                <tr key={u.id} className={u.banned ? "row-del" : ""}>
                  <td>
                    <div className="art-title">{u.username}</div>
                    <div className="art-meta">
                      {u.email || "-"} · 🔖{u.bookmarks} · 💬{u.comments}
                    </div>
                  </td>
                  <td>{u.role}</td>
                  <td>{u.banned ? d.adminBanned : "-"}</td>
                  <td className="admin-actions">
                    {u.role === "admin" ? (
                      <button className="btn-sm" onClick={() => actUsr(u.id, "demote")}>
                        {d.adminDemote}
                      </button>
                    ) : (
                      <button className="btn-sm" onClick={() => actUsr(u.id, "promote")}>
                        {d.adminPromote}
                      </button>
                    )}
                    {u.banned ? (
                      <button className="btn-sm" onClick={() => actUsr(u.id, "unban")}>
                        {d.adminUnban}
                      </button>
                    ) : (
                      <button className="btn-sm danger" onClick={() => actUsr(u.id, "ban")}>
                        {d.adminBan}
                      </button>
                    )}
                    <button className="btn-sm danger" onClick={() => actUsr(u.id, "delete")}>
                      {d.adminDelete}
                    </button>
                  </td>
                </tr>
              ))}
              {usrs.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    {d.adminNoResult}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-v">{value}</div>
      <div className="admin-stat-l">{label}</div>
    </div>
  );
}
