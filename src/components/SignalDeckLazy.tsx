"use client";
// cov30 首屏 JS 瘦身：地球（globe.gl / three）本就在 effect 内动态 import，
// 但 SignalDeck 组件自身（弧线绘制、图例 UI、交互状态）此前被 page.tsx 静态 import，
// 仍进首屏 client bundle。App Router 的 Server Component 不允许 next/dynamic 的
// ssr:false 选项，故用本 client 包装组件承载 dynamic(ssr:false)，把 SignalDeck
// 整块代码拆到独立 chunk，首屏不再下载，地球出现前显示 HUD 占位框。
import dynamic from "next/dynamic";
import type { RegionStat } from "@/lib/sourceGeo";
import type { Locale } from "@/i18n/config";

const SignalDeck = dynamic(() => import("./SignalDeck"), {
  ssr: false,
  loading: () => <div className="signal-deck hud-frame sd-loading" aria-hidden="true" />,
});

export default function SignalDeckLazy({
  regions,
  locale,
}: {
  regions: RegionStat[];
  locale: Locale;
}) {
  return <SignalDeck regions={regions} locale={locale} />;
}
