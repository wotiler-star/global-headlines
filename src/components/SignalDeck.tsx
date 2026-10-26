"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Locale, Category, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { RegionStat, geoLabel, stationOfCountry, cityName, GeoLabel } from "@/lib/sourceGeo";
import { homeHref, articleHref } from "@/lib/paths";
import CurrencyConverter from "@/components/CurrencyConverter";

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

// 活跃度配色：低(青) -> 高(琥珀)
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

// 分类配色（多色分层）
const CAT_COLORS: Record<string, string> = {
  recommend: "#ffb224",
  world: "#22d3ee",
  tech: "#6ea8fe",
  finance: "#3ddc97",
  sports: "#ff7a59",
  entertainment: "#c792ea",
  health: "#f06ea9",
  science: "#7ee787",
  video: "#ff5c8a",
};
function catColor(cat: string): string {
  return CAT_COLORS[cat] || "#ffb224";
}
// 分类色转 rgba（弧线渐变需要带 alpha 的颜色字符串）
function catColorA(cat: string, alpha: number): string {
  const hex = catColor(cat);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 信号弧线：枢纽（选中地区，无则最热地区）→ 最活跃的前 MAX_ARCS 个地区。
// 只画前 N 条是为了避免 21 个地区拉出满屏蛛网（视觉噪声盖过地球本体）。
const MAX_ARCS = 12;
function buildArcs(hub: RegionStat | undefined, list: RegionStat[]) {
  if (!hub) return [];
  return list
    .filter((r) => r.code !== hub.code)
    .slice()
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, MAX_ARCS)
    .map((r) => ({
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: r.lat,
      endLng: r.lng,
      code: r.code,
      cat: r.topCategory,
      activity: r.activity,
    }));
}

// 按经度估算城市当地时间（lng/15 小时，太阳时近似）；Date.now() 即 UTC epoch，直接加时区偏移
function localTime(lng: number): string {
  const d = new Date(Date.now() + (lng / 15) * 3_600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}
// 平均新鲜度（分钟）→ 紧凑文本
function fmtAge(min: number): string {
  if (!min || min < 1) return "<1m";
  if (min < 60) return Math.round(min) + "m";
  const h = min / 60;
  if (h < 24) return h.toFixed(1) + "h";
  return Math.round(h / 24) + "d";
}

// 24h 信号分布迷你图（桶 23 = 最近 1h）；琥珀色折线 + 渐变填充
// 注意：hourDist 由请求时 Date.now() 计算，SSR 输出跨请求不一致（path d 属性每秒可变），
// 必须挂载后渲染，否则水合期间客户端 payload 与 HTML 属性不一致会触发 React #418。
function Sparkline({ data, label }: { data: number[]; label: string }) {
  const w = 216;
  const h = 34;
  const max = Math.max(1, ...data);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => (i * step).toFixed(1) + "," + (h - (v / max) * (h - 3) - 1.5).toFixed(1));
  const line = "M" + pts.join(" L");
  const area = line + " L" + w + "," + h + " L0," + h + " Z";
  return (
    <div className="sd-spark" role="img" aria-label={label}>
      <svg viewBox={"0 0 " + w + " " + h} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="sd-spark-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,178,36,0.38)" />
            <stop offset="100%" stopColor="rgba(255,178,36,0.02)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sd-spark-g)" />
        <path d={line} fill="none" stroke="#ffb224" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="sd-spark-axis">-24h</span>
      <span className="sd-spark-axis now">NOW</span>
    </div>
  );
}

// globe.gl 的地球半径（globeObj 几何体固定值，云层球壳按此比例外扩）
const GLOBE_R = 100;

// 昼夜分界 / 云层自定义着色器（cov24）：
// 顶点着色器只给片元提供 uv 与【世界空间法线】——地球网格自带 rotation.y=-π/2，
// 用 modelMatrix 变换后的法线才能与太阳方向在同一坐标系里点乘。
const GLOBE_VERT = `
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
// 地球本体：日间贴图按受光强度衰减，夜侧切到城市灯光贴图，交界处 smoothstep 出晨昏带
const GLOBE_FRAG = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vec3 n = normalize(vNormalW);
  float d = dot(n, normalize(sunDir));
  float t = smoothstep(-0.26, 0.38, d);                       // 晨昏过渡宽度
  vec3 day = texture2D(dayMap, vUv).rgb * (0.18 + 0.88 * clamp(d + 0.08, 0.0, 1.0));
  vec3 night = texture2D(nightMap, vUv).rgb * 2.3 + vec3(0.030, 0.050, 0.095);
  gl_FragColor = vec4(mix(night, day, t), 1.0);
}
`;
// 云层：白色半透明，白昼明亮、夜侧淡出（避免夜面浮着一层白雾）
const CLOUD_FRAG = `
uniform sampler2D cloudMap;
uniform vec3 sunDir;
uniform float opacity;
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  float a = texture2D(cloudMap, vUv).a * opacity;
  float d = dot(normalize(vNormalW), normalize(sunDir));
  a *= 0.14 + 0.86 * clamp(d + 0.18, 0.0, 1.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0), a);
}
`;

export default function SignalDeck({ regions, locale }: { regions: RegionStat[]; locale: Locale }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<any>(null);
  const hoverCountryRef = useRef<string | null>(null);
  const hoverCodeRef = useRef<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp.get("src");
  const selected = regions.find((r) => r.code === active) || null;
  const [noWebGL, setNoWebGL] = useState(false);
  const [hoverGeo, setHoverGeo] = useState<GeoLabel | null>(null); // 悬停国家/地区（合规展示名）
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [rotating, setRotating] = useState(true);
  const [tour, setTour] = useState(false);      // 自动巡览（每 6s 轮播地区）
  const [booting, setBooting] = useState(true); // 地球初始化占位
  const [mounted, setMounted] = useState(false); // 挂载后再说：SSR 无 searchParams，active 相关 UI 须等挂载后再切换，避免水合树不一致（React #418）
  const [, forceTick] = useState(0); // 30s 刷新相对时间

  const activeRef = useRef(active);
  activeRef.current = active;
  const rotatingRef = useRef(true);
  rotatingRef.current = rotating;
  const tourRef = useRef(false);
  tourRef.current = tour;
  const coordRef = useRef<HTMLSpanElement>(null); // 实时坐标读数（命令式更新，避免 60fps setState）
  const cardRef = useRef<HTMLDivElement>(null);   // 国家分站卡片（命令式跟随鼠标）
  const cardPlaceRef = useRef<(() => void) | null>(null); // 卡片定位函数（globe effect 内赋值）
  const lastMouseRef = useRef({ x: 0, y: 0 });    // 最近一次鼠标在 globe 内的坐标
  const touchRef = useRef(false);                 // 是否触屏设备（影响点击国家行为：触屏先弹卡片）
  // 悬停卡片「移入可点击」：离开国家多边形后延迟清除 hoverGeo，鼠标进入卡片则取消清除
  const hoverClearRef = useRef<number | null>(null);
  const scheduleHoverClear = () => {
    if (hoverClearRef.current) window.clearTimeout(hoverClearRef.current);
    hoverClearRef.current = window.setTimeout(() => {
      setHoverGeo(null);
      hoverCountryRef.current = null;
      hoverCodeRef.current = null;
      setHoverCode(null);
    }, 280);
  };
  const cancelHoverClear = () => {
    if (hoverClearRef.current) {
      window.clearTimeout(hoverClearRef.current);
      hoverClearRef.current = null;
    }
  };

  const total = regions.reduce((s, r) => s + r.signalCount, 0);
  const peak = [...regions].sort((a, b) => b.signalCount - a.signalCount)[0];
  const d = getDict(locale);
  const globalCat = regions
    .flatMap((r) => r.categoryDist)
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.cat] = (acc[c.cat] || 0) + c.n;
      return acc;
    }, {} as Record<string, number>);
  const globalTop = Object.entries(globalCat).sort((a, b) => b[1] - a[1])[0];
  const globalTopName = globalTop ? (d.categories[globalTop[0] as Category] || globalTop[0]) : "—";
  const globalLast = regions.reduce((m, r) => Math.max(m, r.lastSignal || 0), 0);
  const globalCatTop4 = Object.entries(globalCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  // 全区 24h 信号分布（各地区 hourDist 叠加）
  const globalHourDist = regions.reduce<number[]>(
    (acc, r) => acc.map((v, i) => v + ((r.hourDist && r.hourDist[i]) || 0)),
    new Array(24).fill(0) as number[]
  );
  // 全局平均新鲜度（按信号量加权）
  const globalAvgAge = total
    ? Math.round(regions.reduce((s, r) => s + r.avgAgeMin * r.signalCount, 0) / total)
    : 0;
  // 全局最新信号（取 lastSignal 最大地区的最新一条）
  const latestRegion = regions.reduce((m, r) => ((r.lastSignal || 0) > (m.lastSignal || 0) ? r : m), regions[0]);
  // 悬停国家/地区 → 分站卡片数据
  const isCjk = locale === "zh" || locale === "ja" || locale === "ko";
  const hoverStCode = hoverGeo ? stationOfCountry(hoverGeo.en) : undefined;
  const hoverStation = hoverStCode ? regions.find((r) => r.code === hoverStCode) || null : null;
  const hoverGeoName = hoverGeo ? (isCjk ? hoverGeo.zh : hoverGeo.en) : null;
  const hoverGeoSub = hoverGeo ? (isCjk ? hoverGeo.en : hoverGeo.zh) : null;

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
    setMounted(true);
  }, []);

  // 触屏检测（一次性，稳定）
  useEffect(() => {
    touchRef.current =
      typeof window !== "undefined" &&
      (("ontouchstart" in window) || ((navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints || 0) > 0);
  }, []);

  // 自动巡览：每 6s 轮换地区（replace 不进历史栈；POV/弧线/面板由 active 驱动链自动跟随）
  useEffect(() => {
    if (!tour || regions.length === 0) return;
    const order = regions.map((r) => r.code);
    let i = Math.max(0, order.indexOf(active || ""));
    const id = window.setInterval(() => {
      i = (i + 1) % order.length;
      router.replace(homeHref(locale) + "?src=" + order[i]);
    }, 6000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, regions, locale]);

  // 键盘快捷键：←/→ 切换地区 · Esc 清除筛选 · R 自转开关（输入框内不拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const codes = regions.map((r) => r.code);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (codes.length === 0) return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const i = codes.indexOf(active || "");
        const next = i < 0 ? (dir > 0 ? codes[0] : codes[codes.length - 1]) : codes[(i + dir + codes.length) % codes.length];
        router.replace(homeHref(locale) + "?src=" + next);
      } else if (e.key === "Escape") {
        if (active) {
          setTour(false); // 清除筛选同时退出巡览，避免 6s 后被自动补回
          router.push(homeHref(locale));
        }
      } else if (e.key === "r" || e.key === "R") {
        setRotating((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, regions, locale]);

  // 地球初始化（含「进入视口才建」的 IntersectionObserver）
  //
  // 必须先等水合完成（mounted）：IO 回调可能在 React 水合尚未结束时就触发（页面恢复滚动位置、
  // 视口够高时地球一上来就在视口内），而 globe.gl 会往 React 管理的 .sd-globe 容器里注入
  // canvas 与 scene-nav-info 等节点——水合期间插入这些节点会让服务端 HTML 与客户端首帧不一致
  // → 偶发 React #418（args=[HTML,""]，约 1~2 成加载）。故水合前只做 WebGL 探测，不建地球。
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl") || cv.getContext("experimental-webgl");
    if (!gl) {
      setNoWebGL(true);
      setBooting(false);
      return;
    }
    if (!mounted) return; // 水合完成前不创建（下一帧 mounted=true 会重跑本 effect）
    let ro: ResizeObserver | undefined;
    let cancelled = false;
    let cloudRaf = 0;              // 云层自转动画帧
    const timers: number[] = [];   // 需要清理的定时器（太阳方向刷新等）
    let onVisibility: (() => void) | undefined;
    let onGeoMove: ((e: MouseEvent) => void) | undefined;
    let onTouch: ((e: TouchEvent) => void) | undefined;
    let io: IntersectionObserver | undefined;
    let initIo: IntersectionObserver | undefined;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 性能：WebGL 初始化延迟到地球进入视口（提前 200px 预加载）。未滚动到的地球不创建 WebGL 上下文，省首屏算力/显存。
    let started = false;
    const startGlobe = () => {
      if (started || cancelled) return;
      started = true;
      (async () => {
      const Globe = (await import("globe.gl")).default;
      const THREE = await import("three"); // 动态引入，与 globe.gl 同 chunk，不进首屏 bundle
      if (cancelled || !mountRef.current) return;
      const node = mountRef.current;
      const w = node.clientWidth || 600;
      const h = node.clientHeight || 420;
      const dict = getDict(locale);

      // 每地区按其分类分布拆成多个彩色分层点（rank 决定堆叠高度）
      const catPoints = regions.flatMap((r) =>
        (r.categoryDist || []).map((c, i) => ({
          code: r.code,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          cat: c.cat,
          catName: dict.categories[c.cat as Category] || c.cat,
          n: c.n,
          max: r.categoryDist[0] ? r.categoryDist[0].n : 1,
          rank: i,
        }))
      );

      let lastGlobeClick = 0; // 双击复位计时（300ms 内两次点击空白处）
      // 苹果式布光：强环境光打底提亮暗面 + 主光（右上前）塑形 + 冷蓝补光（左前下，模拟大气散射），
      // 让 Blue Marble 贴图整体均匀受光、白昼感（globe.gl 默认只有顶部单侧光，暗面死黑）
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.5 * Math.PI);
      keyLight.position.set(1, 0.55, 1.2);
      const fillLight = new THREE.DirectionalLight(0x9db8ff, 0.28 * Math.PI);
      fillLight.position.set(-1, -0.25, 0.9);
      const world = new Globe(node)
        .width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .showGlobe(true)
        .showGraticules(false)
        .showAtmosphere(true)
        .lights([
          new THREE.AmbientLight(0xeaf2ff, Math.PI * 1.15),
          keyLight,
          fillLight,
        ])
        // 弧线：枢纽端暖琥珀 → 目标端该地区主导分类色（globe.gl 支持色数组渐变）；
        // 线宽/流动速度按活跃度分级；悬停某地区时该条高亮为白色加粗。
        // 亮度按夜侧背景校准（弧线大部分时间飞在暗面上，alpha/线宽给足才可见）。
        .arcColor((d: any) =>
          hoverCodeRef.current === d.code
            ? ["rgba(255,255,255,0.98)", "rgba(255,255,255,0.80)"]
            : ["rgba(255,205,110,0.95)", catColorA(d.cat, 0.88)]
        )
        .arcStroke((d: any) =>
          hoverCodeRef.current === d.code ? 0.46 : 0.16 + (d.activity / 100) * 0.28
        )
        .arcDashLength(0.42)
        .arcDashGap(0.7)
        .arcDashAnimateTime((d: any) => 6500 - (d.activity / 100) * 3500)
        .arcAltitudeAutoScale(0.38)
        .arcsData([] as any)
        .atmosphereColor("#5aa9ff")
        .atmosphereAltitude(0.18)
        .globeImageUrl("/img/earth-day.webp")
        .bumpImageUrl("/img/earth-topology.webp")
        .pointsData(catPoints as any)
        .pointLat("lat")
        .pointLng("lng")
        .pointColor((p: any) => (hoverCodeRef.current === p.code ? "#ffffff" : catColor(p.cat)))
        .pointAltitude((p: any) => 0.01 + p.rank * 0.03)
        .pointRadius((p: any) => 0.12 + (p.n / p.max) * 0.55)
        .pointLabel(
          (p: any) =>
            '<div class="globe-tip"><b>' + p.name + "</b><br>" + p.catName + " · " + p.n + "</div>"
        )
        .ringsData(regions as any)
        .ringLat("lat")
        .ringLng("lng")
        .ringColor((p: any) => activityColorA(p.activity, 0.5))
        .ringMaxRadius((p: any) => 2 + (p.activity / 100) * 4)
        .ringPropagationSpeed(1.1)
        .ringRepeatPeriod(1400)
        .onPointClick((p: any) => onPick(p.code))
        .onPointHover((p: any) => {
          const code = p ? (p as any).code : null;
          hoverCodeRef.current = code;
          setHoverCode(code);
          if (worldRef.current) worldRef.current.pointColor(worldRef.current.pointColor());
        })
        // 双击地球空白处 → 复位全景视角（与 ⤢ 全景按钮等效）
        .onGlobeClick(() => {
          const now = Date.now();
          if (now - lastGlobeClick < 300) {
            world.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 800);
            lastGlobeClick = 0;
          } else {
            lastGlobeClick = now;
          }
        });

      // ---- 昼夜分界线 + 云层（cov24）----
      // 用自定义 ShaderMaterial 按「太阳方向 · 法线」混合日间贴图与夜间灯光贴图：
      // 白昼侧显示 Blue Marble，夜侧亮起城市灯光，中间是真实的晨昏过渡带。
      // 太阳方向按【当前真实 UTC 时刻】计算（赤纬 + 时角），所以晨昏线位置与现实一致。
      const sunDirOfNow = () => {
        const now = new Date();
        const start = Date.UTC(now.getUTCFullYear(), 0, 0);
        const doy = Math.floor((now.getTime() - start) / 86400000);
        const decl = -23.44 * Math.cos((2 * Math.PI * (doy + 10)) / 365); // 太阳赤纬（近似）
        const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        const lng = 180 - utcH * 15; // 12:00 UTC → 直射经度 0°
        const phi = ((90 - decl) * Math.PI) / 180;
        const theta = ((90 - lng) * Math.PI) / 180;
        // 与 globe.gl 的 polar2Cartesian 同一坐标系（y 轴为北极）
        return new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        ).normalize();
      };
      const sunDir = { value: sunDirOfNow() };
      const sunTimer = window.setInterval(() => {
        sunDir.value = sunDirOfNow();
      }, 60000);
      timers.push(sunTimer);

      const loader = new THREE.TextureLoader();
      loader.load("/img/earth-day.webp", (day: any) => {
        if (cancelled) return;
        loader.load("/img/earth-night.webp", (night: any) => {
          if (cancelled) return;
          const mat = new THREE.ShaderMaterial({
            uniforms: { dayMap: { value: day }, nightMap: { value: night }, sunDir },
            vertexShader: GLOBE_VERT,
            fragmentShader: GLOBE_FRAG,
          });
          world.globeMaterial(mat);
        });
      });

      // 云层：略大于地球的独立球壳，白昼明亮、夜侧淡出，并缓慢自转（比地表略快一点）
      const cloudUniforms = {
        cloudMap: { value: null as any },
        sunDir,
        opacity: { value: 0.55 },
      };
      const cloudMat = new THREE.ShaderMaterial({
        uniforms: cloudUniforms,
        vertexShader: GLOBE_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
      });
      loader.load("/img/clouds.webp", (tex: any) => {
        if (!cancelled) cloudUniforms.cloudMap.value = tex;
      });
      let cloudSpin = 0;
      const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 1.008, 48, 24), cloudMat);
      cloudMesh.rotation.y = -Math.PI / 2; // 与地球贴图同朝向
      world
        .customLayerData([{ id: "clouds" }] as any)
        .customThreeObject((_d: any, r: number) => cloudMesh as any)
        .customThreeObjectUpdate((obj: any) => {
          obj.position.set(0, 0, 0);
          obj.rotation.y = -Math.PI / 2 + cloudSpin;
        });
      const spinClouds = () => {
        if (cancelled) return;
        cloudSpin += 0.00022;
        cloudMesh.rotation.y = -Math.PI / 2 + cloudSpin;
        cloudRaf = requestAnimationFrame(spinClouds);
      };
      spinClouds();

      // 地理数据（边界弧线/国家多边形）延迟到浏览器空闲时加载，不阻塞地球首帧
      const deferGeo = (fn: () => void) => {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
        if (ric) ric(fn, { timeout: 1500 });
        else window.setTimeout(fn, 500);
      };
      deferGeo(() => {
      // 国家边界描线（Natural Earth 110m 预解码弧线，淡橙描边贴合站点主题）
      fetch("/img/countries-arcs.json")
        .then((r) => r.json())
        .then((d: any) => {
          if (cancelled || !mountRef.current) return;
          world
            .pathsData(d.arcs as any)
            .pathPoints((p: any) => p)
            .pathPointLat((p: any) => p[1])
            .pathPointLng((p: any) => p[0])
            .pathAltitude(0.005)
            .pathColor(() => "rgba(255,178,36,0.30)")
            .pathStroke(0.35);
        })
        .catch(() => {});

      // 国家层：透明多边形用于悬停识别 + 高亮描边 + 分站卡片
      fetch("/img/countries.geojson")
        .then((r) => r.json())
        .then((fc: any) => {
          if (cancelled || !worldRef.current) return;
          world
            .polygonsData(fc.features as any)
            .polygonCapColor(() => "rgba(0,0,0,0)")
            .polygonSideColor(() => "rgba(0,0,0,0)")
            .polygonStrokeColor((f: any) =>
              hoverCountryRef.current === (f.properties && f.properties.name)
                ? "rgba(255,196,90,0.95)"
                : "rgba(255,178,36,0.0)")
            .polygonAltitude(0.012)
            .onPolygonHover((f: any) => {
              const nm = f ? (f.properties && f.properties.name) : null;
              if (nm) {
                cancelHoverClear();
                hoverCountryRef.current = nm;
                setHoverGeo(geoLabel(nm, f.properties && f.properties.nameZh));
                // 该国已建站 → 联动点亮对应城市点与图例（视觉指引"点这里"）
                const stCode = stationOfCountry(nm);
                hoverCodeRef.current = stCode || null;
                setHoverCode(stCode || null);
                if (worldRef.current) {
                  worldRef.current.polygonStrokeColor(worldRef.current.polygonStrokeColor());
                  worldRef.current.pointColor(worldRef.current.pointColor());
                }
              } else {
                scheduleHoverClear();
              }
            })
            // 点击国家 → 有分站则进入；触屏设备先弹出分站卡片（含"进入分站"按钮），避免误触直跳
            .onPolygonClick((f: any) => {
              const nm = f && f.properties ? f.properties.name : null;
              if (!nm) return;
              const code = stationOfCountry(nm);
              if (touchRef.current) {
                cancelHoverClear();
                hoverCountryRef.current = nm;
                setHoverGeo(geoLabel(nm, f.properties && f.properties.nameZh));
                hoverCodeRef.current = code || null;
                setHoverCode(code || null);
                return;
              }
              if (code) onPick(code);
            });
        })
        .catch(() => {});
      });

      // 高 DPI 屏像素比限制 1.5（4K 屏渲染像素可降一半以上）
      const renderer = world.renderer && world.renderer();
      if (renderer && renderer.setPixelRatio) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      }

      const ctrl = world.controls();
      ctrl.autoRotate = !prefersReduced && rotating && !tour;
      ctrl.autoRotateSpeed = 0.5;
      ctrl.enableZoom = true;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      ctrl.minDistance = 180;
      ctrl.maxDistance = 420;
      ctrl.enablePan = false;
      // 实时坐标读数：controls change 时把相机对应的经纬度写进 HUD（命令式更新，不触发 React 重渲染）
      const writeCoord = () => {
        const el = coordRef.current;
        if (!el || !world.camera) return;
        const p = world.camera().position;
        const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
        const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, p.y / r))) * 180) / Math.PI;
        let lng = 90 - (Math.atan2(p.z, p.x) * 180) / Math.PI;
        lng = ((lng + 540) % 360) - 180;
        el.textContent = "LAT " + lat.toFixed(1) + "° · LON " + lng.toFixed(1) + "°";
      };
      ctrl.addEventListener?.("change", writeCoord);
      writeCoord();
      // 交互时暂停自转，松手 1.2s 后恢复（浏览更聚焦；toggleRotate 可永久关）
      let resumeTimer: number | undefined;
      ctrl.addEventListener?.("start", () => {
        window.clearTimeout(resumeTimer);
        ctrl.autoRotate = false;
        if (tourRef.current) setTour(false); // 用户拖拽 → 退出自动巡览
      });
      ctrl.addEventListener?.("end", () => {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          if (rotatingRef.current && !prefersReduced && !tourRef.current) ctrl.autoRotate = true;
        }, 1200);
      });

      // 离屏 / 后台标签页暂停渲染循环（省 GPU/CPU）
      const pauseRender = () => { try { world.pauseAnimation?.(); } catch (e) {} };
      const resumeRender = () => { try { world.resumeAnimation?.(); } catch (e) {} };
      onVisibility = () => { if (document.hidden) pauseRender(); else resumeRender(); };
      document.addEventListener("visibilitychange", onVisibility);
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver((entries) => {
          for (const en of entries) {
            if (en.isIntersecting) resumeRender();
            else pauseRender();
          }
        });
        io.observe(node);
      }

      worldRef.current = world;
      // 补转初始/重挂载镜头（cov25 遗留 bug 修复）：
      // 进入分站直载（?src=XXX）或 remount 时 active 已存在，但地球是「进入视口才创建」、
      // worldRef 此刻仍为 null，[active] 镜头 effect 在水合/初始化窗口内跳过 → 地球不转向该地区。
      // 这里在地球就绪的同一刻补转（altitude 2.2 与手动选中一致，duration 0 避免加载期突兀滑动）。
      if (activeRef.current) {
        const r = regions.find((x) => x.code === activeRef.current);
        if (r) world.pointOfView({ lat: r.lat, lng: r.lng, altitude: 2.2 }, 0);
      }
      setBooting(false); // 地球就绪，关闭初始化占位

      // 国家分站卡片跟随鼠标：记录坐标 + 命令式定位（mousemove 不触发 React 重渲染）
      const wrapEl = node.parentElement;
      const placeCard = () => {
        const card = cardRef.current;
        if (!card || !wrapEl) return;
        const wr = wrapEl.getBoundingClientRect();
        const cw = card.offsetWidth || 200;
        const ch = card.offsetHeight || 110;
        const gap = 16;
        let x = lastMouseRef.current.x + gap;
        let y = lastMouseRef.current.y + gap;
        if (x + cw > wr.width - 8) x = Math.max(8, lastMouseRef.current.x - cw - gap); // 近右缘 → 翻到左侧
        if (y + ch > wr.height - 8) y = Math.max(8, lastMouseRef.current.y - ch - gap); // 近下缘 → 翻到上方
        card.style.left = x + "px";
        card.style.top = y + "px";
      };
      const onGeoMoveHandler = (e: MouseEvent) => {
        if (!wrapEl) return;
        const wr = wrapEl.getBoundingClientRect();
        lastMouseRef.current = { x: e.clientX - wr.left, y: e.clientY - wr.top };
        placeCard();
      };
      onGeoMove = onGeoMoveHandler;
      node.addEventListener("mousemove", onGeoMoveHandler);
      // 触屏：记录触点坐标并定位卡片（触屏无 mousemove，需在 touchstart/touchmove 用触点位置）
      const onTouchHandler = (e: TouchEvent) => {
        if (!wrapEl || !e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const wr = wrapEl.getBoundingClientRect();
        lastMouseRef.current = { x: t.clientX - wr.left, y: t.clientY - wr.top };
        placeCard();
      };
      onTouch = onTouchHandler;
      node.addEventListener("touchstart", onTouchHandler, { passive: true });
      node.addEventListener("touchmove", onTouchHandler, { passive: true });
      cardPlaceRef.current = placeCard;
      // 初始链路弧：最热地区 -> 最活跃的前 MAX_ARCS 个地区（effect 首跑时 worldRef 未就绪，这里补铺）
      const hub0 = [...regions].sort((a, b) => b.signalCount - a.signalCount)[0];
      if (hub0 && regions.length > 1) {
        world.arcsData(buildArcs(hub0, regions) as any);
      }
      ro = new ResizeObserver(() => {
        if (worldRef.current && mountRef.current) {
          worldRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
        }
      });
      ro.observe(node);
      })();
    };

    // 进入视口（或提前 200px）才真正创建地球；不支持 IO 时直接创建。
    if (typeof IntersectionObserver !== "undefined") {
      initIo = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (en.isIntersecting) {
              initIo?.disconnect();
              startGlobe();
              break;
            }
          }
        },
        { rootMargin: "200px" }
      );
      initIo.observe(el);
    } else {
      startGlobe();
    }

    function onPick(code: string) {
      setTour(false); // 点地球选点与图例一致：退出自动巡览
      const base = homeHref(locale);
      if (activeRef.current === code) router.push(base);
      else router.push(base + "?src=" + code);
    }

    return () => {
      cancelled = true;
      if (cloudRaf) cancelAnimationFrame(cloudRaf); // 云层自转
      for (const t of timers) window.clearInterval(t); // 太阳方向刷新等
      if (ro) ro.disconnect();
      if (initIo) initIo.disconnect();
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      if (onGeoMove && mountRef.current) mountRef.current.removeEventListener("mousemove", onGeoMove);
      if (onTouch && mountRef.current) {
        mountRef.current.removeEventListener("touchstart", onTouch);
        mountRef.current.removeEventListener("touchmove", onTouch);
      }
      cardPlaceRef.current = null;
      if (io) io.disconnect();
      try {
        if (worldRef.current && worldRef.current._destructor) worldRef.current._destructor();
      } catch (e) {}
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, mounted]);

  // 自转开关同步（自动巡览期间强制停转，避免镜头对抗）
  useEffect(() => {
    const w = worldRef.current;
    if (w && w.controls) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      w.controls().autoRotate = !prefersReduced && rotating && !tour;
    }
  }, [rotating, tour]);

  // 悬停国家变化时重定位分站卡片（含自转把国家转到静止鼠标下、无 mousemove 的场景）
  useEffect(() => {
    if (hoverGeo) cardPlaceRef.current?.();
  }, [hoverGeo]);

  // 选中地区时把地球转向它
  useEffect(() => {
    const w = worldRef.current;
    if (w && active && selected) {
      w.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: 2.2 }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 信号链路：选中地区（无选中则最热地区）向其他地区发射流动弧线
  useEffect(() => {
    const w = worldRef.current;
    if (!w || !w.arcsData) return;
    const hub = selected || peak;
    if (!hub || regions.length < 2) {
      w.arcsData([]);
      return;
    }
    w.arcsData(buildArcs(hub, regions) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, regions]);

  // 悬停变化时重算弧线配色/线宽（弧线不具备自动刷新机制，需手动触发访问器）
  useEffect(() => {
    const w = worldRef.current;
    if (w && w.arcColor) {
      w.arcColor(w.arcColor());
      w.arcStroke(w.arcStroke());
    }
  }, [hoverCode]);

  function toggleRotate() {
    setRotating((r) => !r);
  }
  function toggleTour() {
    setTour((t) => !t);
  }
  function resetView() {
    if (worldRef.current) worldRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 800);
    router.push(homeHref(locale)); // 复位镜头 + 清除 ?src 筛选
  }
  function pick(code: string) {
    setTour(false); // 显式选择地区 → 退出自动巡览
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
    setTour(false); // 与 Esc 一致：清除筛选同时退出巡览
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
          {booting ? (
            <div className="sd-boot" aria-hidden>
              <span className="sd-boot-ring" />
              <span className="sd-boot-t">INITIALIZING SIGNAL LINK</span>
              <span className="sd-boot-s">信号链路初始化…</span>
            </div>
          ) : (
            /* 占位层永驻 DOM：globe 就绪后仅淡出（class 切换，无结构变化）。
               setBooting 发生在动态 import 的 promise 回调里，若在水合窗口内移除节点会触发 React #418 */
            <div className="sd-boot done" aria-hidden />
          )}
          <div className="sd-scan" aria-hidden />
          {/* 国家/地区分站卡片：悬停地球上的国家时跟随鼠标出现；可移入点击新闻/进入分站 */}
          <div
            className="sd-country-card"
            ref={cardRef}
            style={{ display: hoverGeo ? "block" : "none" }}
            aria-hidden={!hoverGeo}
            onMouseEnter={cancelHoverClear}
            onMouseLeave={scheduleHoverClear}
          >
            {hoverGeo && (
              <>
                <div className="sd-cc-head">
                  <span className="sd-cc-globe">◈</span>
                  <span className="sd-cc-name">{hoverGeoName}</span>
                  {hoverGeoSub && hoverGeoSub !== hoverGeoName ? <span className="sd-cc-en">{hoverGeoSub}</span> : null}
                </div>
                {hoverStation ? (
                  <div className="sd-cc-body">
                    <div className="sd-cc-row">
                      <span>分站 STATION</span>
                      <b>{hoverStation.name} · {hoverStation.code}</b>
                    </div>
                    <div className="sd-cc-row">
                      <span>信号 SIGNAL</span>
                      <b>{hoverStation.signalCount}</b>
                    </div>
                    <div className="sd-cc-bar">
                      <i style={{ width: hoverStation.activity + "%", background: activityColor(hoverStation.activity) }} />
                    </div>
                    {hoverStation.headlines && hoverStation.headlines.length > 0 ? (
                      <div className="sd-cc-news">
                        <div className="sd-cc-news-h">最新资讯 LATEST · {hoverStation.code}</div>
                        {hoverStation.headlines.map((h) => (
                          <button
                            key={h.id + h.locale}
                            className="sd-cc-news-item"
                            onClick={() => router.push(articleHref(h.locale, h.id))}
                          >
                            <span className="sd-cc-dot" style={{ background: catColor(h.category) }} />
                            <span className="sd-cc-nt">{h.title}</span>
                            <span className="sd-cc-ntime" suppressHydrationWarning>{relTime(h.publishedAt, locale)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <button className="sd-cc-enter" onClick={() => hoverStCode && pick(hoverStCode)}>
                      进入分站 STATION ›
                    </button>
                  </div>
                ) : hoverStCode ? (
                  <div className="sd-cc-body">
                    <div className="sd-cc-row">
                      <span>分站 STATION</span>
                      <b>{cityName(hoverStCode, locale)} · {hoverStCode}</b>
                    </div>
                    <div className="sd-cc-none">信号接入中 · NO SIGNAL YET</div>
                  </div>
                ) : (
                  <div className="sd-cc-none">暂无分站 · NO STATION</div>
                )}
              </>
            )}
          </div>
          <ul className="sd-legend" aria-label="地区图例">
            {regions.map((r) => (
              <li
                key={r.code}
                className={"sd-leg-item" + (mounted && active === r.code ? " on" : "") + (hoverCode === r.code ? " hover" : "")}
                role="button"
                tabIndex={0}
                onClick={() => pick(r.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(r.code);
                  }
                }}
                // 悬停图例：镜头转向该地区 + 高亮它那条信号弧线
                onMouseEnter={() => {
                  focusRegion(r.code);
                  hoverCodeRef.current = r.code;
                  setHoverCode(r.code);
                }}
                onMouseLeave={() => {
                  hoverCodeRef.current = null;
                  setHoverCode(null);
                }}
                title={r.name}
              >
                <span
                  className="sd-leg-dot"
                  style={{ background: activityColor(r.activity), color: activityColor(r.activity) }}
                />
                <span className="sd-leg-code">{r.code}</span>
                <span className="sd-leg-name">{r.name}</span>
                <span className="sd-leg-bar">
                  <i
                    style={{
                      width: (peak && peak.signalCount ? Math.max(8, Math.round((r.signalCount / peak.signalCount) * 100)) : 8) + "%",
                      background: activityColor(r.activity),
                    }}
                  />
                </span>
                <span className="sd-leg-count">{r.signalCount}</span>
              </li>
            ))}
          </ul>
          <div className="sd-cat-legend" aria-label="分类色图例">
            {categories
              .filter((c) => c !== "recommend")
              .map((c) => (
                <span className="sd-cl-item" key={c}>
                  <span className="sd-cl-dot" style={{ background: catColor(c) }} />
                  {d.categories[c as Category] || c}
                </span>
              ))}
          </div>
          {/* 货币兑换浮动卡：地球旁 HUD 风格，纯前端静态汇率换算 */}
          <CurrencyConverter locale={locale} />
        </div>
      )}

      <div className="sd-foot">
        <span>
          <span style={{ color: "var(--live)" }}>●</span> 拖拽旋转 · 滚轮缩放 · 双击复位 · ←/→ 切换地区
          {hoverGeo ? " · 国家/地区 " + hoverGeoName : ""}
          {!hoverGeo && hoverCode ? " · 地区 " + (regions.find((x) => x.code === hoverCode)?.name || hoverCode) : ""}
          {mounted && selected ? " · 当前 " + selected.code : ""}
          <span className="sd-coord" ref={coordRef} />
        </span>
        <span className="sd-foot-right">
          <button
            className={"sd-rot" + (tour ? " on" : "")}
            onClick={toggleTour}
            aria-label={tour ? "停止自动巡览" : "开始自动巡览"}
          >
            {tour ? "◎ 巡览中" : "◎ AUTO"}
          </button>
          <button className="sd-rot" onClick={resetView} aria-label="回到全景">
            ⤢ 全景
          </button>
          <button className="sd-rot" onClick={toggleRotate} aria-label="切换自转">
            {rotating ? "⏸ 暂停" : "▶ 自转"}
          </button>
          <span className="sd-sync">SYNC LIVE</span>
        </span>
      </div>

      {/* 面板：挂载前恒渲染全球面板（与 SSR 一致，避免 ?src= 直载时水合树不一致）；挂载后按 selected 切换 */}
      {!mounted || !selected ? (
        <div className="sd-panel is-global">
          <div className="sd-panel-head">
            <div>
              <div className="sd-panel-code">GLOBAL</div>
              <div className="sd-panel-name">全球概览</div>
            </div>
          </div>
          <div className="sd-metrics">
            <div className="sd-metric">
              <span className="sd-m-label">信号总量 TOTAL</span>
              <span className="sd-m-val">{total}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">覆盖地区 REGIONS</span>
              <span className="sd-m-val">{regions.length}</span>
            </div>
            <div className="sd-metric sd-m-full">
              <span className="sd-m-label">最热地区 PEAK</span>
              <span className="sd-m-val sd-m-sm">{peak.name} · {peak.signalCount}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">最新信号 LAST</span>
              <span className="sd-m-val sd-m-sm" suppressHydrationWarning>{globalLast ? relTime(globalLast, locale) : "—"}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">平均新鲜度 AVG AGE</span>
              <span className="sd-m-val sd-m-sm" suppressHydrationWarning>{globalAvgAge ? fmtAge(globalAvgAge) : "—"}</span>
            </div>
            <div className="sd-metric sd-m-full">
              <span className="sd-m-label">主导分类 TOP</span>
              <span className="sd-m-val sd-m-sm">{globalTopName}</span>
            </div>
          </div>
          {mounted && <Sparkline data={globalHourDist} label="过去 24 小时全球信号分布" />}
          {latestRegion && latestRegion.latestTitle ? (
            <button
              className="sd-latest"
              onClick={() => latestRegion.latestId && router.push(articleHref(locale, latestRegion.latestId))}
            >
              <span className="sd-latest-k">最新信号 LATEST · {latestRegion.code}</span>
              <span className="sd-latest-t">{latestRegion.latestTitle}</span>
              <span className="sd-latest-x" suppressHydrationWarning>{relTime(latestRegion.lastSignal, locale)} ›</span>
            </button>
          ) : null}
          {globalCatTop4.length > 0 && (
            <div className="sd-cat">
              <div className="sd-cat-title">分类分布 CATEGORY</div>
              {globalCatTop4.map(([cat, n]) => (
                <div className="sd-cat-row" key={cat}>
                  <span className="sd-cat-name">{d.categories[cat as Category] || cat}</span>
                  <span className="sd-cat-bar">
                    <span
                      className="sd-cat-fill"
                      style={{ width: (n / globalCatTop4[0][1]) * 100 + "%", background: catColor(cat) }}
                    />
                  </span>
                  <span className="sd-cat-n">{n}</span>
                </div>
              ))}
            </div>
          )}
          <div className="sd-global-hint">点击地球地区或左侧图例 → 筛选该区信息流</div>
        </div>
      ) : null}
      {mounted && selected && (
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
              <span className="sd-m-val sd-m-sm" suppressHydrationWarning>{relTime(selected.lastSignal, locale)}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">活跃度 ACTIVITY</span>
              <span className="sd-m-val">{selected.activity}%</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">本地时间 LOCAL</span>
              <span className="sd-m-val sd-m-sm" suppressHydrationWarning>{localTime(selected.lng)}</span>
            </div>
            <div className="sd-metric">
              <span className="sd-m-label">平均新鲜度 AVG AGE</span>
              <span className="sd-m-val sd-m-sm" suppressHydrationWarning>{selected.avgAgeMin ? fmtAge(selected.avgAgeMin) : "—"}</span>
            </div>
          </div>

          {selected.latestTitle ? (
            <button
              className="sd-latest"
              onClick={() => selected.latestId && router.push(articleHref(locale, selected.latestId))}
            >
              <span className="sd-latest-k">最新信号 LATEST</span>
              <span className="sd-latest-t">{selected.latestTitle}</span>
              <span className="sd-latest-x" suppressHydrationWarning>{relTime(selected.lastSignal, locale)} ›</span>
            </button>
          ) : null}

          {mounted && <Sparkline data={selected.hourDist || []} label={"过去 24 小时" + selected.name + "信号分布"} />}

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
                    <span
                      className="sd-cat-fill"
                      style={{ width: pct + "%", background: catColor(c.cat) }}
                    />
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
