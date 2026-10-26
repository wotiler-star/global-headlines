"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

const CACHE_KEY = "gh_weather";
type Wx = { city: string; temp: number; icon: string };

// 今日头条式顶栏右侧：天气（IP 定位城市 + 温度）/ 消息（未读红点）/ 发布作品。
// 天气由 /api/weather 服务端按访客 IP 定位（不用浏览器定位，避免权限策略拦截与弹窗），
// 浏览器侧再缓存 30 分钟。取不到天气整块隐藏，不展示错误城市。
export default function TopBarExtras({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const [wx, setWx] = useState<Wx | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // 消息未读数（未登录返回 401，按 0 处理）
    fetch("/api/me/messages")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setUnread(Number(j.unread) || 0); })
      .catch(() => {});

    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (raw && raw.w && Date.now() - Number(raw.t || 0) < 1800_000) {
        setWx(raw.w as Wx);
        return;
      }
    } catch {
      /* ignore */
    }

    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const w = j?.weather as Wx | null;
        if (!w || typeof w.temp !== "number") return;
        setWx(w);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), w }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="tb-extras">
      {wx && (
        <span className="tbx-weather" title={wx.city ? `${wx.city} ${wx.temp}°C` : `${wx.temp}°C`}>
          <span className="tbx-icon" aria-hidden>{wx.icon}</span>
          {wx.city && <span className="tbx-city">{wx.city}</span>}
          <span className="tbx-temp">{wx.temp}°</span>
        </span>
      )}
      <Link href={`/${locale}/me`} className="tbx-msg" aria-label={d.navMessage}>
        <span aria-hidden>✉</span>
        <span className="tbx-label">{d.navMessage}</span>
        {unread > 0 && <span className="tbx-dot">{unread}</span>}
      </Link>
      <Link href={`/${locale}/write`} className="tbx-publish">
        {d.navPublish}
      </Link>
    </div>
  );
}
