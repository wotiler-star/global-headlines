"use client";

import { useEffect, useRef } from "react";

/**
 * 广告位：挂载上报一次曝光；点击上报一次点击。
 * 收入按 60% 分成给稿件作者（服务端 /api/ads/event 结算）。
 */
export default function AdSlot({ articleId }: { articleId?: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, kind: "impression" }),
    }).catch(() => {});
  }, [articleId]);

  const click = () => {
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, kind: "click" }),
    }).catch(() => {});
  };

  return (
    <div className="ad-slot" role="complementary" aria-label="advertisement">
      <div className="ad-slot-tag">AD · 推广</div>
      <div className="ad-slot-body">
        <b>全球头条 · 流量变现计划</b>
        <span>你的稿件曝光与点击将按比例分成，计入会员中心余额。</span>
      </div>
      <button type="button" className="ad-slot-cta" onClick={click}>
        了解更多
      </button>
    </div>
  );
}
