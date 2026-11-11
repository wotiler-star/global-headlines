"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, localeMeta, isLocale } from "@/i18n/config";

// ---------------------------------------------------------------------------
// 按访客 IP 自动切换语种（客户端异步，不阻塞首屏）。
//
// SEO 安全约束（关键）：
//  1) 搜索引擎爬虫完全豁免——Googlebot 会执行 JS，若在 /zh/article/xxx 上被
//     自动跳走，会破坏该语言版本的索引。middleware 里已有一层豁免，这里是第二层。
//  2) 显式带语种前缀的深层 URL（文章页等）只显示建议提示条，不强制跳转，
//     保证分享链接、外链落地页、爬虫抓取的 URL 稳定不变。
//  3) 自动切换只在首页路径发生（绝大多数自然入口），并用 swapLocale 保留查询参数。
//  4) 结果写入 gh_locale cookie（180 天），用户手动切换优先级最高，之后不再判断。
// ---------------------------------------------------------------------------

const COOKIE = "gh_locale";
const UNDO_KEY = "gh_geo_undo"; // sessionStorage：切换后在新页面显示可撤销提示
const BOT = /(googlebot|bingbot|baiduspider|yandex|duckduckbot|sogou|360spider|slurp|applebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|semrushbot|ahrefsbot|mj12bot|petalbot|bytespider|gptbot|claudebot|ccbot|ia_archiver|crawler|spider|bot\b)/i;

type Copy = {
  auto: (lang: string) => string;   // 已自动切换后的撤销条
  undo: string;
  suggest: (lang: string) => string; // 深层页建议
  switchTo: string;
  keep: string;
};

const COPY: Record<Locale, Copy> = {
  zh: { auto: (l) => `已根据您所在地区切换到 ${l}`, undo: "撤销", suggest: (l) => `您所在地区建议使用 ${l}，是否切换？`, switchTo: "切换", keep: "保持当前" },
  en: { auto: (l) => `Switched to ${l} based on your region`, undo: "Undo", suggest: (l) => `${l} is recommended for your region. Switch?`, switchTo: "Switch", keep: "Stay here" },
  ja: { auto: (l) => `地域に基づき ${l} に切り替えました`, undo: "元に戻す", suggest: (l) => `お住まいの地域では ${l} がおすすめです。切り替えますか？`, switchTo: "切り替える", keep: "このまま" },
  ko: { auto: (l) => `지역에 따라 ${l}(으)로 전환했습니다`, undo: "되돌리기", suggest: (l) => `해당 지역에서는 ${l}을(를) 권장합니다. 전환할까요?`, switchTo: "전환", keep: "현재 유지" },
  es: { auto: (l) => `Cambiado a ${l} según tu región`, undo: "Deshacer", suggest: (l) => `Se recomienda ${l} para tu región. ¿Cambiar?`, switchTo: "Cambiar", keep: "Quedarme aquí" },
  fr: { auto: (l) => `Passage à ${l} selon votre région`, undo: "Annuler", suggest: (l) => `${l} est recommandé pour votre région. Changer ?`, switchTo: "Changer", keep: "Rester ici" },
  pt: { auto: (l) => `Alterado para ${l} com base na sua região`, undo: "Desfazer", suggest: (l) => `${l} é recomendado para sua região. Mudar?`, switchTo: "Mudar", keep: "Manter atual" },
  tr: { auto: (l) => `Bölgenize göre ${l} diline geçildi`, undo: "Geri al", suggest: (l) => `Bölgeniz için ${l} öneriliyor. Geçilsin mi?`, switchTo: "Geç", keep: "Burada kal" },
  ru: { auto: (l) => `Переключено на ${l} по вашему региону`, undo: "Отменить", suggest: (l) => `${l} рекомендуется для вашего региона. Переключить?`, switchTo: "Переключить", keep: "Остаться здесь" },
  ar: { auto: (l) => `تم التبديل إلى ${l} بناءً على منطقتك`, undo: "تراجع", suggest: (l) => `${l} موصى به لمنطقتك. تبديل؟`, switchTo: "تبديل", keep: "البقاء هنا" },
  hi: { auto: (l) => `आपके क्षेत्र के आधार पर ${l} में बदला गया`, undo: "पूर्ववत करें", suggest: (l) => `आपके क्षेत्र के लिए ${l} अनुशंसित है। बदलें?`, switchTo: "बदलें", keep: "यहीं रहें" },
  id: { auto: (l) => `Beralih ke ${l} berdasarkan wilayah Anda`, undo: "Urungkan", suggest: (l) => `${l} disarankan untuk wilayah Anda. Beralih?`, switchTo: "Beralih", keep: "Tetap di sini" },
};

function readCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch { return undefined; }
}

function setCookie(locale: string) {
  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${COOKIE}=${encodeURIComponent(locale)};path=/;max-age=${maxAge};samesite=lax;secure`;
}

/** 把当前路径的语言段替换为 next，保留查询串 */
function swapLocalePath(pathname: string, next: Locale): string {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length && isLocale(seg[0])) seg[0] = next;
  else seg.unshift(next);
  return "/" + seg.join("/");
}

export default function GeoLocaleGuard({ locale }: { locale: Locale }) {
  const pathname = usePathname() || `/${locale}`;
  const router = useRouter();
  const [notice, setNotice] = useState<"undo" | "suggest" | null>(null);
  const [target, setTarget] = useState<Locale | null>(null);
  const copy = COPY[locale];

  useEffect(() => {
    // 1) 爬虫豁免
    if (BOT.test(navigator.userAgent)) return;
    // 2) 切换后落在新页面 → 优先显示可撤销提示（必须在 cookie 判断之前：
    //    自动切换已写入 cookie，若先判断 cookie 会提前 return，撤销条永远不出现）
    try {
      const raw = sessionStorage.getItem(UNDO_KEY);
      if (raw) {
        sessionStorage.removeItem(UNDO_KEY);
        const u = JSON.parse(raw) as { from: Locale; to: Locale };
        if (u.to === locale && u.from !== locale) {
          setTarget(u.from);
          setNotice("undo");
          const t = setTimeout(() => setNotice(null), 10000);
          return () => clearTimeout(t);
        }
      }
    } catch { /* ignore */ }

    // 3) 用户已明确选择过语种 → 完全尊重，不再判断
    if (readCookie(COOKIE)) return;

    // 4) 首次访客：异步定位
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    fetch("/api/geo", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j || j.source === "unknown") return;
        const next = j.locale as Locale;
        if (!isLocale(next) || next === locale) {
          // 语种已合适：写 cookie 记住，避免后续重复探测
          setCookie(locale);
          return;
        }
        const isHome = /^\/[a-z]{2}\/?$/.test(pathname) || pathname === "/";
        if (isHome) {
          // 自动切换（仅首页），记录来源以便撤销
          try {
            sessionStorage.setItem(UNDO_KEY, JSON.stringify({ from: locale, to: next }));
          } catch { /* ignore */ }
          setCookie(next);
          router.replace(swapLocalePath(pathname, next));
        } else {
          // 深层 URL：只建议，不强制跳转
          setTarget(next);
          setNotice("suggest");
        }
      })
      .catch(() => { /* 定位失败：静默降级，保持当前语种 */ })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); ctrl.abort(); };
  }, [locale, pathname, router]);

  const acceptLocale = (next: Locale) => {
    setCookie(next);
    setNotice(null);
    router.push(swapLocalePath(pathname, next));
  };

  const keepCurrent = () => {
    setCookie(locale); // 记住选择，不再提示
    setNotice(null);
  };

  const undo = () => {
    if (!target) return;
    setCookie(target);
    setNotice(null);
    router.replace(swapLocalePath(pathname, target));
  };

  if (!notice) return null;
  const langName = target ? localeMeta[target].name : "";

  return (
    <div className="geo-locale-toast" role="status" aria-live="polite">
      <span className="glt-text">
        {notice === "undo" ? copy.auto(localeMeta[locale].name) : copy.suggest(langName)}
      </span>
      <span className="glt-actions">
        {notice === "undo" ? (
          <button type="button" className="glt-btn" onClick={undo}>{copy.undo}</button>
        ) : (
          <>
            <button type="button" className="glt-btn primary" onClick={() => target && acceptLocale(target)}>{copy.switchTo}</button>
            <button type="button" className="glt-btn" onClick={keepCurrent}>{copy.keep}</button>
          </>
        )}
        <button type="button" className="glt-close" onClick={() => setNotice(null)} aria-label="Close">×</button>
      </span>
    </div>
  );
}
