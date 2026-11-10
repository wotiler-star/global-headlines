"use client";

import { useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { SITE_URL } from "@/lib/site";
import { articleHref } from "@/lib/paths";

// 文章分享：原生 Web Share / 复制链接 + 4 个社交平台外链入口。
// 社交平台 URL 一律 nofollow + noopener + noreferrer：不向外部域传递权重，
// 同时让内容更容易被分享出去，形成指向本站的真实外部曝光。
export default function ShareBar({
  locale,
  id,
  title,
}: {
  locale: Locale;
  id: string;
  title: string;
}) {
  const d = getDict(locale);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const url = `${SITE_URL}${articleHref(locale, id)}`;
  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);
  const channels = [
    { label: "𝕏", name: "X", href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}` },
    { label: "f", name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}` },
    { label: "in", name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}` },
    { label: "✈", name: "Telegram", href: `https://t.me/share/url?url=${encUrl}&text=${encTitle}` },
  ];

  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* 用户取消或不支持，落到复制 */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 剪贴板不可用：忽略 */
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", gap: 6 }}>
      <button type="button" className="share-btn" onClick={share}>
        <span aria-hidden>🔗</span>
        {copied ? d.copied : d.copyLink}
      </button>
      <button
        type="button"
        className="share-btn"
        style={{ paddingInline: 10 }}
        aria-label="More sharing options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
            display: "flex", gap: 6, padding: 8, borderRadius: 12,
            background: "var(--surface-2, #fff)", border: "1px solid var(--line, #ddd)",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          }}
        >
          {channels.map((ch) => (
            <a
              key={ch.name}
              role="menuitem"
              href={ch.href}
              target="_blank"
              rel="nofollow noopener noreferrer"
              title={`Share on ${ch.name}`}
              aria-label={`Share on ${ch.name}`}
              className="share-btn"
              style={{ paddingInline: 12, textDecoration: "none" }}
              onClick={() => setOpen(false)}
            >
              {ch.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
