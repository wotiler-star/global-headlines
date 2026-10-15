"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Locale, Category } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { RegionStat } from "@/lib/sourceGeo";
import { homeHref } from "@/lib/paths";

const REL: Record<string, { just: string; min: string; hr: string; day: string }> = {
  zh: { just: "刚刚", min: "分钟前", hr: "小时前", day: "天前" },
  en: { just: "just now", min: "m ago", hr: "h ago", day: "d ago" },
  ja: { just: "たった今", min: "分前", hr: "時間前", day: "日前" },
  ko: { just: "방금", min: "분 전", hr: "시간 전", day: "일 전" },
  es: { just: "ahora", min: "min", hr: "h", day: "d" },
  fr: { just: "à l'instant", min: "min", hr: "h", day: "j" },
  de: { just: "gerade", min: "Min", hr: "h", day: "T" },
};

function relTime(ms: number, locale: Locale): string {
  const u = REL[locale] || REL.en;
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return u.just;
  if (m < 60) return m + " " + u.min;
  const h = Math.floor(m / 60);
  if (h < 24) return h + " " + u.hr;
  return Math.floor(h / 24) + " " + u.day;
}

// 活跃度配色：低(青) -> 高(琥珀)，让热点地区更"烫"
function activityRGB(a: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (a || 0) / 100));
  const r = Math.round(34 + (255 - 34) * t);
  const g = Math.round(211 + (178 - 211) * t);
  const b = Math.round(238 + (36 - 238) * t);
  return [r, g, b];
}
function activityColor(a: number): string {
  const [r, g, b] = activityRGB(a);
  return `rgb(${r},${g},${b})`;
}
function activityColorA(a: number, alpha: number): string {
  const [r, g, b] = activityRGB(a);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function SignalDeck({ regions, locale }: { regions: RegionStat[]; locale: Locale }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<any>(null);
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp.get("src");
  const selected = regions.find((r) => r.code === active) || null;
  const [noWebGL, setNoWebGL] = useState(false);
  const [rotating, setRotating] = useState(true);
  const [, forceTick] = useState(0); // 30s 刷新相对时间

  const activeRef = useRef(active);
  activeRef.current = active;

  const total = regions.reduce((s, r) => s + r.signalCount, 0);
  const peak = regions[0];
  const d = getDict(locale);

  // live last-signal time
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // 尊重 reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRotating(false);
    }
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl") || cv.getContext("experimental-webgl");
    if (!gl) {
      setNoWebGL(true);
      return;
    }
    let ro: ResizeObserver | undefined;
    let cancelled = false;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      const Globe = (await import("globe.gl")).default;
      const THREE = await import("three");
      if (cancelled || !mountRef.current) return;
      const node = mountRef.current;
      const w = node.clientWidth || 600;
      const h = node.clientHeight || 420;
      const world = new Globe(node)
        .width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .showGlobe(true)
        .showGraticules(true)
        .showAtmosphere(true)
        .atmosphereColor("#ffb224")
        .atmosphereAltitude(0.22)
        .globeMaterial(
          new THREE.MeshPhongMaterial({ color: "#0a0e14", emissive: "#070a0f", shininess: 2 })
        )
        .pointsData(regions as any)
        .pointLat("lat")
        .pointLng("lng")
        .pointColor((p: any) => activityColor(p.activity))
        .pointAltitude(0.012)
        .pointRadius((p: any) => 0.22 + (p.activity / 100) * 0.5)
        .pointLabel(
          (p: any) =>
            '<div class="globe-tip"><b>' +
            p.name +
            "</b><br>" +
            p.signalCount +
            " SIGNALS · " +
            p.code +
            " · ACT " +
            p.activity +
            "%</div>"
        )
        .ringsData(regions as any)
        .ringLat("lat")
        .ringLng("lng")
        .ringColor((p: any) => activityColorA(p.activity, 0.5))
        .ringMaxRadius((p: any) => 2 + (p.activity / 100) * 4)
        .ringPropagationSpeed(1.1)
        .ringRepeatPeriod(1400)
        .onPointClick((p: any) => onPick(p.code));

      const ctrl = world.controls();
      ctrl.autoRotate = !prefersReduced && rotating;
      ctrl.autoRotateSpeed = 0.5;
      ctrl.enableZoom = true;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      ctrl.minDistance = 180;
      ctrl.maxDistance = 420;
      ctrl.enablePan = false;

      worldRef.current = world;
      ro = new ResizeObserver(() => {
        if (worldRef.current && mountRef.current) {
          worldRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
        }
      });
      ro.observe(node);
    })();

    function onPick(code: string) {
      const base = homeHref(locale);
      if (activeRef.current === code) router.push(base);
      else router.push(base + "?src=" + code);
    }

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      try {
        if (worldRef.current && worldRef.current._destructor) worldRef.current._destructor();
      } catch (e) {}
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  // 自转开关同步
  useEffect(() => {
    const w = worldRef.current;
    if (w && w.controls) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      w.controls().autoRotate = !prefersReduced && rotating;
    }
  }, [rotating]);

  // 选中地区时把地球转向它
  useEffect(() => {
    const w = worldRef.current;
    if (w && active && selected) {
      w.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: 2.2 }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggleRotate() {
    setRotating((r) => !r);
  }
  function pick(code: string) {
    const base = homeHref(locale);
    if (active === code) router.push(base);
    else router.push(base + "?src=" + code);
  }
  function focusRegion(code: string) {
    const w = worldRef.current;
    const r = regions.find((x) => x.code === code);
    if (w && r) w.pointOfView({ lat: r.lat, lng: r.lng, altitude: 2.2 }, 600);
  }
  function clearFilter() {
    router.push(homeHref(locale));
  }

  return (
    <div className="signal-deck hud-frame">
      <span className="hud-c tl" />
      <span className="hud-c tr" />
      <span className="hud-c bl" />
      <span className="hud-c br" />
      <div className="sd-head">
        <span className="sd-title">SIGNAL GLOBE // 全球信号地球</span>
        <span className="sd-stats">
          {total} SIGNALS · {regions.length} REGIONS
          {peak ? " · PEAK " + peak.name : ""}
        </span>
      </div>

      {noWebGL ? (
        <div className="sd-fallback">
          {regions.map((r) => (
            <button key={r.code} className="sd-fb-item" onClick={() => pick(r.code)}>
              <span className="sd-fb-code">{r.code}</span>
              <span className="sd-fb-name">{r.name}</span>
              <span className="sd-fb-count">{r.signalCount}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sd-globe-wrap">
          <div className="sd-globe" ref={mountRef} />
          <ul className="sd-legend" aria-label="地区图例">
            {regions.map((r) => (
              <li
                key={r.code}
                className={"sd-leg-item" + (active === r.code ? " on" : "")}
                onClick={() => pick(r.code)}
                onMouseEnter={() => focusRegion(r.code)}
                title={r.name}
              >
                <span
                  className="sd-leg-dot"
                  style={{ background: activityColor(r.activity), color: activityColor(r.activity) }}
                />
                <span className="sd-leg-code">{r.code}</span>
                <span className="sd-leg-name">{r.name}</span>
                <span className="sd-leg-count">{r.signalCount}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sd-foot">
        <span>
          <span style={{ color: "var(--live)" }}>●</span> 拖拽旋转 · 悬停/点击地区查看指标
          {selected ? " · 当前 " + selected.code : ""}
        </span>
        <span className="sd-foot-right">
          <button className="sd-rot" onClick={toggleRotate} aria-label="切换自转">
            {rotating ? "⏸ 暂停" : "▶ 自转"}
          </button>
          <span className="sd-sync">SYNC LIVE</span>
        </span>
      </div>

      {selected && (
        <div className="sd-panel">
          <div className="sd-panel-head">
            <div>
              <div className="sd-panel-code">{selected.code}</div>
              <div className="sd-panel-name">{selected.name}</div>
            </div>
            <button className="sd-clear" onClick={clearFilter} aria-label="清除筛选">
              ×
            </button>
          </div>
          <div className="sd-metrics">
            <div className="sd-metric">
              <span className="sd-m-label">信号量 SIGNAL</span>
              <span className="sd-m-val">{selected.signalCount}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">活跃源 SOURCES</span>
              <span className="sd-m-val">{selected.sources}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">最新信号 LAST</span>
              <span className="sd-m-val sd-m-sm">{relTime(selected.lastSignal, locale)}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">活跃度 ACTIVITY</span>
              <span className="sd-m-val">{selected.activity}%</span>
            </div>
          </div>

          {selected.sourcesList && selected.sourcesList.length > 0 && (
            <div className="sd-sources">
              <div className="sd-cat-title">活跃源域名 ACTIVE SOURCES</div>
              <div className="sd-src-list">
                {selected.sourcesList.map((s) => (
                  <span key={s} className="sd-src-chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="sd-act-bar">
            <div className="sd-act-fill" style={{ width: selected.activity + "%" }} />
          </div>
          <div className="sd-cat">
            <div className="sd-cat-title">分类分布 CATEGORY</div>
            {selected.categoryDist.map((c) => {
              const max = selected.categoryDist[0] ? selected.categoryDist[0].n : 1;
              const pct = (c.n / max) * 100;
              const catName = d.categories[c.cat as Category] || c.cat;
              return (
                <div className="sd-cat-row" key={c.cat}>
                  <span className="sd-cat-name">{catName}</span>
                  <span className="sd-cat-bar">
                    <span className="sd-cat-fill" style={{ width: pct + "%" }} />
                  </span>
                  <span className="sd-cat-n">{c.n}</span>
                </div>
              );
            })}
          </div>
          <div className="sd-topcat">
            主导分类 TOP · {d.categories[selected.topCategory as Category] || selected.topCategory}
          </div>
        </div>
      )}
    </div>
  );
}
