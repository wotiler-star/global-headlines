"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { homeHref } from "@/lib/paths";
import { GeoPoint } from "@/lib/sourceGeo";

export interface SourceSignal extends GeoPoint {
  count: number;
}

const CONTINENTS = [
  "M70,55 L150,45 L185,60 L180,85 L200,95 L195,115 L170,120 L160,140 L140,135 L120,110 L90,105 L75,85 Z",
  "M150,150 L185,145 L190,170 L180,210 L165,245 L155,230 L150,195 L140,170 Z",
  "M305,60 L345,50 L370,60 L365,80 L340,90 L310,85 Z",
  "M310,100 L365,95 L380,120 L370,160 L350,195 L330,190 L315,150 L305,120 Z",
  "M375,50 L480,40 L540,55 L560,80 L540,100 L500,110 L460,100 L420,85 L385,75 Z",
  "M490,175 L545,170 L560,190 L540,215 L505,210 L488,195 Z",
];

const GRID_X = [170, 340, 510];
const GRID_Y = [62, 125, 188];

// 全球信号源地图：点阵世界 + 源脉冲 + 雷达扫描；点击脉冲按 src 参数过滤信息流
export default function SignalOriginMap({
  locale,
  sources,
}: {
  locale: Locale;
  sources: SourceSignal[];
}) {
  const sp = useSearchParams();
  const active = sp.get("src");
  const d = getDict(locale);
  const total = sources.reduce((s, x) => s + x.count, 0);
  const base = homeHref(locale);
  const label = d.signalMapTitle || "全球信号源";

  return (
    <div className="signal-map hud-frame" aria-label={label}>
      <span className="hud-c tl" />
      <span className="hud-c tr" />
      <span className="hud-c bl" />
      <span className="hud-c br" />
      <div className="sm-head">
        <span className="sm-title">SIGNAL ORIGIN MAP // {label}</span>
        <span className="sm-count">
          {sources.length} SOURCES · {total} SIGNALS
        </span>
      </div>
      <svg className="sm-svg" viewBox="0 0 680 250" role="img" aria-label={label}>
        <defs>
          <pattern id="sm-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" style={{ fill: "var(--ink-3)" }} opacity="0.35" />
          </pattern>
        </defs>
        {GRID_Y.map((y) => (
          <line key={"gy" + y} x1="0" y1={y} x2="680" y2={y} style={{ stroke: "var(--line)" }} strokeWidth="0.5" />
        ))}
        {GRID_X.map((x) => (
          <line key={"gx" + x} x1={x} y1="0" x2={x} y2="250" style={{ stroke: "var(--line)" }} strokeWidth="0.5" />
        ))}
        {CONTINENTS.map((p, i) => (
          <path key={i} d={p} fill="url(#sm-dots)" />
        ))}
        <line className="sweep" x1="340" y1="125" x2="340" y2="-45" style={{ stroke: "var(--brand)" }} strokeWidth="1" opacity="0.22" />
        <circle cx="340" cy="125" r="2.5" style={{ fill: "var(--brand)" }} />
        {sources.map((s, i) => {
          const on = active === s.code;
          return (
            <Link
              key={s.code}
              href={on ? base : base + "?src=" + s.code}
              className={"pulse-link" + (on ? " on" : "")}
              aria-label={s.code + " 信号源 " + s.count + " 篇"}
            >
              <circle cx={s.x} cy={s.y} r="16" fill="transparent" />
              <circle
                className="p-ring"
                cx={s.x}
                cy={s.y}
                r="13"
                fill="none"
                style={{ stroke: "var(--brand)", animationDelay: "-" + (i * 0.7).toFixed(1) + "s" }}
                strokeWidth="1"
              />
              <circle className="p-dot" cx={s.x} cy={s.y} r="3" style={{ fill: on ? "var(--brand)" : "var(--live)" }} />
              <text
                className="p-label"
                x={s.x}
                y={s.y - 20}
                textAnchor="middle"
                style={{ fill: "var(--ink-2)", fontFamily: "var(--font-mn)", fontSize: 11 }}
              >
                {s.code} ×{s.count}
              </text>
            </Link>
          );
        })}
      </svg>
      <div className="sm-foot">
        <span>
          <span style={{ color: "var(--live)" }}>●</span> 信号源 · 点击脉冲过滤该源信号
          {active ? " · 当前 " + active : ""}
        </span>
        <span>SYNC T-2MIN</span>
      </div>
    </div>
  );
}
