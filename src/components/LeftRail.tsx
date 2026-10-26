"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { homeHref } from "@/lib/paths";
import { useAuth } from "@/lib/auth-client";

// 左栏（对标今日头条首页左侧）：登录卡 + 热门话题。桌面展示，移动端隐藏。
export default function LeftRail({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const { user, ready, openLogin, logout } = useAuth();
  const topics = d.hotSearches;
  const [unread, setUnread] = useState(0);

  // 登录后拉取未读消息数（铃铛角标）
  useEffect(() => {
    if (!ready || !user) {
      setUnread(0);
      return;
    }
    let alive = true;
    const load = () =>
      fetch("/api/me/messages")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j && typeof j.unread === "number") setUnread(j.unread);
        })
        .catch(() => {});
    load();
    const t = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [ready, user]);

  return (
    <>
      <div className="panel login-card">
        <div className="avatar">{user?.avatar || "头"}</div>
        {ready && user ? (
          <>
            <div className="lc-title">{d.authHi(user.username)}</div>
            <div className="lc-links">
              <Link href={`/${locale}/me`} className="lc-btn">
                🏠 {d.memberCenter}
              </Link>
              <Link href={`/${locale}/write`} className="lc-btn">
                ✍️ {d.memberWrite}
              </Link>
              <Link href={`/${locale}/me`} className="lc-btn">
                🔔 {d.memberMessages}
                {unread > 0 ? ` (${unread})` : ""}
              </Link>
            </div>
            <button type="button" className="lc-btn ghost" onClick={() => logout()}>
              {d.authLogout}
            </button>
          </>
        ) : (
          <>
            <div className="lc-title">{d.loginPrompt}</div>
            <button type="button" className="lc-btn" onClick={() => openLogin(`/${locale}/me`)}>
              {d.loginBtn}
            </button>
          </>
        )}
      </div>
      {ready && user && user.role === "admin" && (
        <div className="panel">
          <h3>
            <span className="bar" />
            {d.adminTitle}
          </h3>
          <Link href={`/${locale}/admin`} className="topic">
            <span className="topic-ic">⚙</span>
            {d.adminTitle}
          </Link>
        </div>
      )}
      {ready && user && unread > 0 && (
        <div className="panel">
          <h3>
            <span className="bar" />
            {d.memberMessages}
          </h3>
          <Link href={`/${locale}/me`} className="topic">
            <span className="topic-ic">🔔</span>
            {unread} {d.memberUnread}
          </Link>
        </div>
      )}
      <div className="panel">
        <h3>
          <span className="bar" />
          {d.trendingTitle}
        </h3>
        <div className="topic-list">
          {topics.map((t) => (
            <Link key={t} href={`${homeHref(locale)}?q=${encodeURIComponent(t)}`} className="topic">
              <span className="topic-ic">#</span>
              {t}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
