"use client";

import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { homeHref } from "@/lib/paths";
import { useAuth } from "@/lib/auth-client";

// 左栏（对标今日头条首页左侧）：登录卡 + 热门话题。桌面展示，移动端隐藏。
export default function LeftRail({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const { user, ready, openLogin, logout } = useAuth();
  const topics = d.hotSearches;

  return (
    <>
      <div className="panel login-card">
        <div className="avatar">头</div>
        {ready && user ? (
          <>
            <div className="lc-title">{d.authHi(user.username)}</div>
            <button type="button" className="lc-btn ghost" onClick={() => logout()}>
              {d.authLogout}
            </button>
          </>
        ) : (
          <>
            <div className="lc-title">{d.loginPrompt}</div>
            <button type="button" className="lc-btn" onClick={openLogin}>
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
