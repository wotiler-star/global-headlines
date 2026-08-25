"use client";

import { useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { SITE_URL } from "@/lib/site";
import { articleHref } from "@/lib/paths";

// 文章分享：优先调用系统原生分享（移动端），否则复制链接到剪贴板。
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
  const url = `${SITE_URL}${articleHref(locale, id)}`;

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
    <button type="button" className="share-btn" onClick={share}>
      <span aria-hidden>🔗</span>
      {copied ? d.copied : d.copyLink}
    </button>
  );
}
