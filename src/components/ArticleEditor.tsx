"use client";

import { useEffect, useRef, useState } from "react";
import { Locale, locales, categories } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth-client";
import { countWords, MIN_BODY_CHARS } from "@/lib/moderation";

type Snap = {
  artLocale: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  source: string;
  tags: string;
};

const emptySnap = (locale: string): Snap => ({
  artLocale: locale,
  category: "world",
  title: "",
  summary: "",
  body: "",
  source: "",
  tags: "",
});

export default function ArticleEditor({ locale, editId }: { locale: Locale; editId?: string }) {
  const d = getDict(locale);
  const { user } = useAuth();
  const [artLocale, setArtLocale] = useState<string>(locale);
  const [category, setCategory] = useState<string>("world");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOff, setCropOff] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropNat, setCropNat] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cropFit, setCropFit] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ d0: number; s0: number; ax: number; ay: number; ox: number; oy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);
  // 云端稿件 id：新建时首 autosave 建草稿后才产生，此后所有保存都走 PATCH
  const [docId, setDocId] = useState<string | null>(editId || null);
  const [docStatus, setDocStatus] = useState<"draft" | "pending" | "published" | "rejected">("draft");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [cloudState, setCloudState] = useState<"idle" | "saving" | "saved">("idle");
  const [cloudAt, setCloudAt] = useState<number | null>(null);

  // ---------- 草稿自动保存（localStorage，崩溃/断网恢复向） ----------
  const DRAFT_KEY = "gh_editor_draft:" + (editId || "new");
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const restoredRef = useRef(false);

  // ---------- 未保存更改守卫 ----------
  const snapRef = useRef<Snap>(emptySnap(locale)); // 最近一次保存/加载时的快照
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const pendingBack = useRef(false);
  const bypass = useRef(false);

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    fetch("/api/me/articles")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const a = (j.items || []).find((x: { id: string }) => x.id === editId);
        if (a) {
          setArtLocale(a.locale);
          setCategory(a.category);
          setTitle(a.title);
          setSummary(a.summary || "");
          setBody(a.body || a.summary || "");
          setSource(a.source || "");
          setTags((a.tags || []).join(", "));
          setCover(a.cover || null);
          setDocId(a.id);
          setDocStatus(a.status || "published");
          setReviewNote(a.reviewNote || null);
          snapRef.current = {
            artLocale: a.locale,
            category: a.category,
            title: a.title,
            summary: a.summary || "",
            body: a.body || a.summary || "",
            source: a.source || "",
            tags: (a.tags || []).join(", "),
          };
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [editId]);

  // dirty：当前表单与快照不一致
  useEffect(() => {
    if (!loaded) return;
    const now: Snap = { artLocale, category, title, summary, body, source, tags };
    setDirty(JSON.stringify(now) !== JSON.stringify(snapRef.current));
  }, [loaded, artLocale, category, title, summary, body, source, tags]);

  // 挂载后检查本地草稿：与当前快照不同则提示恢复
  useEffect(() => {
    if (!loaded || restoredRef.current) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || (!d.title && !d.body && !d.summary)) return;
      const snap = snapRef.current;
      const same =
        (d.title || "") === snap.title &&
        (d.body || "") === snap.body &&
        (d.summary || "") === snap.summary &&
        (d.category || "world") === snap.category &&
        (d.artLocale || locale) === snap.artLocale &&
        (d.source || "") === snap.source &&
        (d.tags || "") === snap.tags;
      if (!same) setDraftInfo({ savedAt: d.savedAt || Date.now() });
    } catch {
      /* localStorage 不可用则跳过 */
    }
  }, [loaded, DRAFT_KEY, locale]);

  // 防抖自动保存（停止输入 800ms 后落盘；空内容不保存）
  useEffect(() => {
    if (!loaded) return;
    if (!title.trim() && !body.trim() && !summary.trim()) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ artLocale, category, title, summary, body, source, tags, savedAt: Date.now() })
        );
        setSavedAt(Date.now());
      } catch {
        /* 忽略配额错误 */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [loaded, artLocale, category, title, summary, body, source, tags, DRAFT_KEY]);

  const applyDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setArtLocale(d.artLocale || locale);
      setCategory(d.category || "world");
      setTitle(d.title || "");
      setSummary(d.summary || "");
      setBody(d.body || "");
      setSource(d.source || "");
        setTags(d.tags || "");
      }
    } catch {
      /* ignore */
    }
    restoredRef.current = true;
    setDraftInfo(null);
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftInfo(null);
  };

  // 关闭标签/刷新
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // 站内链接点击（capture 阶段拦截，早于 Next Link 的根委托）
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (bypass.current || leaveOpen) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && (!url.search || url.hash)) return; // 同页/锚点不拦
      e.preventDefault();
      e.stopPropagation();
      pendingHref.current = url.pathname + url.search + url.hash;
      pendingBack.current = false;
      setLeaveOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, leaveOpen]);

  // 浏览器后退/前进：先回填当前 URL，确认后再放行
  useEffect(() => {
    if (!dirty) return;
    const onPop = () => {
      if (bypass.current) return;
      history.pushState(null, "", window.location.href);
      pendingHref.current = null;
      pendingBack.current = true;
      setLeaveOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  const requestLeave = (href: string) => {
    pendingHref.current = href;
    pendingBack.current = false;
    setLeaveOpen(true);
  };

  const preview = () => {
    const id = docId || editId;
    if (id) window.open(`/${locale}/article/${id}`, "_blank", "noopener");
  };

  const confirmLeave = () => {
    const href = pendingHref.current;
    const back = pendingBack.current;
    setLeaveOpen(false);
    bypass.current = true;
    if (back) {
      history.back();
      return;
    }
    if (href) window.location.assign(href);
  };

  // 压缩到最长边≤1600px 的 JPEG blob（失败回退原文件）
  const shrink = (file: Blob): Promise<Blob> =>
    new Promise((resolve) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const MAX = 1600;
        let w = img.naturalWidth || MAX;
        let h = img.naturalHeight || MAX;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });

  const uploadCover = async (blob: Blob) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "cover.jpg");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) setCover(j.url);
      else setErr(j.error || "upload failed");
    } catch {
      setErr("upload error");
    } finally {
      setUploading(false);
    }
  };

  const onCover = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) { setErr(d.coverTip); return; }
    if (file.size > 10 * 1024 * 1024) { setErr(d.coverTip); return; }
    // 读为 dataURL 打开裁剪模态（用户也可选择直接使用原图）
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(String(reader.result || ""));
      setCropScale(1);
      setCropOff({ x: 0, y: 0 });
      setCropNat({ w: 0, h: 0 });
      setCropFit({ w: 0, h: 0 });
      setFrame({ w: 0, h: 0 });
    };
    reader.readAsDataURL(file);
  };

  const cancelCrop = () => {
    setCropSrc(null);
    setCropScale(1);
    setCropOff({ x: 0, y: 0 });
    setCropNat({ w: 0, h: 0 });
    setCropFit({ w: 0, h: 0 });
    setFrame({ w: 0, h: 0 });
  };

  const useOriginalCover = async () => {
    const src = cropSrc;
    cancelCrop();
    if (!src) return;
    const blob = await (await fetch(src)).blob();
    await uploadCover(await shrink(blob));
  };

  const confirmCrop = async () => {
    const src = cropSrc;
    if (!src) return;
    setUploading(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = src;
      });
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const stage = stageRef.current;
      const sw = stage ? stage.clientWidth : iw;
      const sh = stage ? stage.clientHeight : ih;
      const ratio = Math.min(sw / iw, sh / ih);
      const fitW = iw * ratio;
      const fitH = ih * ratio;
      const dispW = fitW * cropScale;
      const dispH = fitH * cropScale;
      // 框（固定居中）中心对应的图片归一化坐标
      const nx = (dispW / 2 - cropOff.x) / dispW;
      const ny = (dispH / 2 - cropOff.y) / dispH;
      // 16:9 裁剪区（自然尺寸，缩放越大越小）
      const baseCh = Math.min(ih, Math.round(iw * 9 / 16));
      const chN = Math.max(1, Math.round(baseCh / cropScale));
      const cwN = Math.round(chN * 16 / 9);
      const sx = Math.min(iw - cwN, Math.max(0, Math.round(nx * iw - cwN / 2)));
      const sy = Math.min(ih - chN, Math.max(0, Math.round(ny * ih - chN / 2)));
      const cv = document.createElement("canvas");
      cv.width = cwN;
      cv.height = chN;
      const ctx = cv.getContext("2d");
      if (!ctx) { cancelCrop(); return; }
      ctx.drawImage(img, sx, sy, cwN, chN, 0, 0, cwN, chN);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/jpeg", 0.9));
      cancelCrop();
      if (blob) await uploadCover(await shrink(blob));
    } catch {
      setErr("crop error");
    } finally {
      setUploading(false);
    }
  };

  // 裁剪：移动（拖拽） + 缩放（滚轮，以框中心为锚）
  // 图片显示尺寸 = contain 基准 * scale；框固定居中，移动图片
  const clampOff = (s: number, o: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage || !cropNat.w || !cropFit.w) return o;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const dispW = cropFit.w * s;
    const dispH = cropFit.h * s;
    const baseCh = Math.min(cropNat.h, Math.round(cropNat.w * 9 / 16));
    const chN = Math.max(1, baseCh / s);
    const cwN = (chN * 16) / 9;
    const nxMin = cwN / (2 * cropNat.w);
    const nyMin = chN / (2 * cropNat.h);
    const nxMax = 1 - nxMin;
    const nyMax = 1 - nyMin;
    const clampAxis = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    return {
      x: clampAxis(o.x, dispW / 2 - nxMax * dispW, dispW / 2 - nxMin * dispW),
      y: clampAxis(o.y, dispH / 2 - nyMax * dispH, dispH / 2 - nyMin * dispH),
    };
  };

  const onCropDown = (e: any) => {
    if (e.target && e.target.closest && e.target.closest(".crop-zoom")) return;
    if (e.preventDefault) e.preventDefault();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { px: x, py: y, ox: cropOff.x, oy: cropOff.y };
  };
  const onCropMove = (e: any) => {
    if (!dragRef.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const next = { x: dragRef.current.ox + x - dragRef.current.px, y: dragRef.current.oy + y - dragRef.current.py };
    setCropOff(clampOff(cropScale, next));
  };
  const onCropUp = () => { dragRef.current = null; };

  // 复位缩放与平移（双击 stage 或点击倍率角标）
  const resetCrop = () => {
    setCropScale(1);
    setCropOff({ x: 0, y: 0 });
  };

  const onCropWheel = (e: any) => {
    if (!cropNat.w || !cropFit.w) return;
    const sOld = cropScale;
    const sNew = Math.min(3, Math.max(1, sOld * (1 - (e.deltaY || 0) / 600)));
    if (sNew === sOld) return;
    const dispOldW = cropFit.w * sOld;
    const dispOldH = cropFit.h * sOld;
    const dispNewW = cropFit.w * sNew;
    const dispNewH = cropFit.h * sNew;
    // 缩放前后维持框中心对应同一图片点（锚定）
    const nx = (dispOldW / 2 - cropOff.x) / dispOldW;
    const ny = (dispOldH / 2 - cropOff.y) / dispOldH;
    const o2 = { x: dispNewW / 2 - nx * dispNewW, y: dispNewH / 2 - ny * dispNewH };
    setCropScale(sNew);
    setCropOff(clampOff(sNew, o2));
  };

  // wheel/touch 需要非 passive 事件才能 preventDefault（React onWheel/onTouchMove 默认 passive）
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const wheelH = (ev: WheelEvent) => {
      ev.preventDefault();
      onCropWheel(ev);
    };
    const tsH = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
      if ((ev.target as Element).closest(".crop-zoom")) return;
      if (ev.touches.length >= 2) {
        const [a, b] = [ev.touches[0], ev.touches[1]];
        const stage = stageRef.current;
        if (!stage) return;
        const r = stage.getBoundingClientRect();
        pinchRef.current = {
          d0: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
          s0: cropScale,
          ax: (a.clientX + b.clientX) / 2 - (r.left + r.width / 2),
          ay: (a.clientY + b.clientY) / 2 - (r.top + r.height / 2),
          ox: cropOff.x,
          oy: cropOff.y,
        };
        dragRef.current = null;
      } else if (ev.touches.length === 1) {
        const t = ev.touches[0];
        dragRef.current = { px: t.clientX, py: t.clientY, ox: cropOff.x, oy: cropOff.y };
        pinchRef.current = null;
      }
    };
    const tmH = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
      if (ev.touches.length >= 2) {
        const p = pinchRef.current;
        const stage = stageRef.current;
        if (!p || !stage) return;
        const [a, b] = [ev.touches[0], ev.touches[1]];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const s1 = Math.min(3, Math.max(1, p.s0 * (d / p.d0)));
        const r = stage.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - (r.left + r.width / 2);
        const cy = (a.clientY + b.clientY) / 2 - (r.top + r.height / 2);
        // 捏合锚定：双指中心缩放前后对应同一图片点；中心位移同步平移
        const k = s1 / p.s0;
        const o2 = { x: cx - (p.ax - p.ox) * k, y: cy - (p.ay - p.oy) * k };
        setCropScale(s1);
        setCropOff(clampOff(s1, o2));
      } else if (ev.touches.length === 1 && dragRef.current) {
        const t = ev.touches[0];
        const next = {
          x: dragRef.current.ox + t.clientX - dragRef.current.px,
          y: dragRef.current.oy + t.clientY - dragRef.current.py,
        };
        setCropOff(clampOff(cropScale, next));
      }
    };
    const teH = (ev: TouchEvent) => {
      if (ev.touches.length >= 2) return; // 仍在捏合
      if (ev.touches.length === 1) {
        // 抬起一指：接续为单指拖拽
        const t = ev.touches[0];
        dragRef.current = { px: t.clientX, py: t.clientY, ox: cropOff.x, oy: cropOff.y };
        pinchRef.current = null;
        return;
      }
      dragRef.current = null;
      pinchRef.current = null;
    };
    el.addEventListener("wheel", wheelH, { passive: false });
    el.addEventListener("touchstart", tsH, { passive: false });
    el.addEventListener("touchmove", tmH, { passive: false });
    el.addEventListener("touchend", teH);
    el.addEventListener("touchcancel", teH);
    return () => {
      el.removeEventListener("wheel", wheelH);
      el.removeEventListener("touchstart", tsH);
      el.removeEventListener("touchmove", tmH);
      el.removeEventListener("touchend", teH);
      el.removeEventListener("touchcancel", teH);
    };
  }, [cropSrc, cropScale, cropOff, cropNat, cropFit]);

  const splitTags = (raw: string): string[] =>
    raw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);

  // ---------- 云端自动保存：草稿不再只躺 localStorage，换设备也能续写 ----------
  const persistDraft = async (): Promise<string | null> => {
    if (!title.trim() || busy) return docId;
    setCloudState("saving");
    const base = {
      locale: artLocale,
      category,
      title: title.trim(),
      summary: summary.trim() || null,
      body,
      source: source.trim() || null,
      tags: splitTags(tags),
      cover: cover || null,
    };
    try {
      let id = docId;
      if (!id) {
        const r = await fetch("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, status: "draft" }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr(j.error || "network error");
          setCloudState("idle");
          return null;
        }
        id = j.id;
        setDocId(id);
        setDocStatus("draft");
      } else {
        // 不带 status：保持稿件当前状态（已发布稿件的自动存盘不该触发重审）
        const r = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr(j.error || "network error");
          setCloudState("idle");
          return null;
        }
        if (j.status) setDocStatus(j.status);
      }
      snapRef.current = { artLocale, category, title, summary, body, source, tags };
      setDirty(false);
      setCloudState("saved");
      setCloudAt(Date.now());
      return id;
    } catch {
      setCloudState("idle");
      return null;
    }
  };

  // 停止输入 12s 后静默存到云端（有标题才存，避免产生空草稿）
  useEffect(() => {
    if (!loaded || !dirty || !title.trim()) return;
    const t = window.setTimeout(() => {
      void persistDraft();
    }, 12000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, dirty, title, summary, body, category, artLocale, source, tags, cover, docId]);

  // ---------- 正文编辑工具：极简 Markdown 行内/行首标记 ----------
  const wrapSelection = (before: string, after: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = el.value.slice(s, e);
    const next = el.value.slice(0, s) + before + sel + after + el.value.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + before.length + sel.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const prefixSelectionLines = (prefix: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const lineStart = el.value.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = el.value.indexOf("\n", e);
    if (lineEnd === -1) lineEnd = el.value.length;
    const block = el.value.slice(lineStart, lineEnd);
    const lines = block.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l));
    const next = el.value.slice(0, lineStart) + lines.join("\n") + el.value.slice(lineEnd);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + lines.join("\n").length);
    });
  };

  const submit = async (mode: "draft" | "publish") => {
    setErr(null);
    if (!title.trim()) {
      setErr(d.memberTitlePh);
      return;
    }
    if (mode === "publish" && body.trim().length < MIN_BODY_CHARS) {
      setErr(d.writeNeedBody);
      return;
    }
    setBusy(true);
    // 服务端会再裁决一次（普通会员的 published 一律落到待审核），这里只是给 UI 一个预期
    const status = mode === "publish" ? (user?.role === "admin" ? "published" : "pending") : "draft";
    try {
      const payload = {
        locale: artLocale,
        category,
        title: title.trim(),
        summary: summary.trim() || null,
        body,
        source: source.trim() || null,
        tags: splitTags(tags),
        cover: cover || null,
        status,
      };
      const target = docId || editId;
      const r = await fetch(target ? `/api/articles/${encodeURIComponent(target)}` : "/api/articles", {
        method: target ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "failed");
        setBusy(false);
        return;
      }
      // 保存成功：刷新快照（清除 dirty），放行后续导航
      snapRef.current = { artLocale, category, title, summary, body, source, tags };
      setDirty(false);
      if (j.status) setDocStatus(j.status);
      if (status === "draft" && j.id) setDocId(j.id);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      if (mode === "draft") {
        setBusy(false);
        bypass.current = true;
        setCloudState("saved");
        setCloudAt(Date.now());
        return;
      }
      // 提交审核/发布后跳转到会员中心查看结果
      bypass.current = true;
      window.location.assign(`/${locale}/me`);
    } catch {
      setErr("network error");
      setBusy(false);
    }
  };

  const ago = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return d.agoJustNow;
    if (s < 3600) return d.agoMinutes(Math.floor(s / 60));
    if (s < 86400) return d.agoHours(Math.floor(s / 3600));
    return d.agoDays(Math.floor(s / 86400));
  };

  if (!loaded) return <div className="write"><p className="member-muted">{d.loadingMore}</p></div>;

  return (
    <div className="write">
      <h1>{docId ? d.memberEditArticle : d.memberWriteNew}</h1>
      {(docId || reviewNote) && (
        <div className="write-status">
          {(docId ? docStatus : "draft") === "draft" && <span className="status-pill draft">{d.memberDraft}</span>}
          {docId && docStatus === "pending" && <span className="status-pill pending">{d.reviewPending}</span>}
          {docId && docStatus === "published" && <span className="status-pill published">{d.memberPublished}</span>}
          {docId && docStatus === "rejected" && <span className="status-pill rejected">{d.reviewRejected}</span>}
          {docId && docStatus === "pending" && <span className="write-status-hint">{d.reviewPendingHint}</span>}
        </div>
      )}
      {docStatus === "rejected" && reviewNote && (
        <div className="reject-banner">
          <strong>{d.rejectReason}</strong>
          <span>{reviewNote}</span>
        </div>
      )}
      {draftInfo && (
        <div className="draft-banner">
          <span>
            {d.draftFound}（{ago(draftInfo.savedAt)}）
          </span>
          <div className="draft-banner-actions">
            <button type="button" className="btn-sm" onClick={applyDraft}>
              {d.draftRestore}
            </button>
            <button type="button" className="btn-sm danger" onClick={discardDraft}>
              {d.draftDiscard}
            </button>
          </div>
        </div>
      )}
      <label className="member-field">
        <span className="field-head"><span>{d.memberTitlePh}</span><span className="char-count">{title.length}/120</span></span>
        <input className="write-title-input" placeholder={d.memberTitlePh} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="member-field">
        <span className="field-head"><span>{d.memberSummaryPh}</span><span className="char-count">{summary.length}/300</span></span>
        <textarea className="write-summary-input" placeholder={d.memberSummaryPh} value={summary} maxLength={300} rows={3} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <label className="member-field">
        <span className="field-head">
          <span>{d.memberBodyPh}</span>
          <span className="char-count">{body.length}/{countWords(body)} {d.editorWords}</span>
        </span>
        <div className="md-bar">
          <button type="button" className="md-btn" title={d.mdBold} onClick={() => wrapSelection("**", "**")}><b>B</b></button>
          <button type="button" className="md-btn" title={d.mdItalic} onClick={() => wrapSelection("*", "*")}><i>I</i></button>
          <button type="button" className="md-btn" title={d.mdHeading} onClick={() => prefixSelectionLines("## ")}>H</button>
          <button type="button" className="md-btn" title={d.mdList} onClick={() => prefixSelectionLines("- ")}>&#8226;</button>
          <button type="button" className="md-btn" title={d.mdQuote} onClick={() => prefixSelectionLines("> ")}>&rdquo;</button>
          <span className="md-tip">{d.memberBodyHint}</span>
        </div>
        <textarea
          ref={bodyRef}
          className="write-body-input"
          placeholder={d.memberBodyPh}
          value={body}
          rows={16}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label className="member-field">
        <span>{d.coverAdd}</span>
        <div className="cover-input">
          {cover ? (
            <div className="cover-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="cover" />
              <button type="button" className="cover-remove" onClick={() => setCover(null)}>{d.coverRemove}</button>
            </div>
          ) : (
            <label className="cover-upload">
              <input type="file" accept="image/*" onChange={onCover} hidden />
              <span>+ {d.coverAdd}</span>
            </label>
          )}
          {uploading && <span className="member-muted">{d.uploading}…</span>}
        </div>
        <p className="cover-tip">{d.coverTip}</p>
      </label>
      {cropSrc && (
        <div className="crop-modal">
          <div className="crop-box">
            <div className="crop-title">{d.cropTitle}</div>
            <div className="crop-hint">{d.cropHint}</div>
            <div
              ref={stageRef}
              className="crop-stage"
              onMouseDown={onCropDown}
              onMouseMove={onCropMove}
              onMouseUp={onCropUp}
              onMouseLeave={onCropUp}
              onDoubleClick={resetCrop}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropSrc}
                alt="crop"
                draggable={false}
                onLoad={(ev) => {
                  const stage = stageRef.current;
                  const nw = ev.currentTarget.naturalWidth;
                  const nh = ev.currentTarget.naturalHeight;
                  if (stage && nw && nh) {
                    const ratio = Math.min(stage.clientWidth / nw, stage.clientHeight / nh);
                    setCropNat({ w: nw, h: nh });
                    setCropFit({ w: Math.round(nw * ratio), h: Math.round(nh * ratio) });
                    const fw = Math.min(stage.clientWidth, Math.round(stage.clientHeight * 16 / 9));
                    setFrame({ w: fw, h: Math.round((fw * 9) / 16) });
                  }
                }}
                style={cropFit.w ? { width: cropFit.w, height: cropFit.h, transform: `translate(${cropOff.x}px, ${cropOff.y}px) scale(${cropScale})` } : undefined}
              />
              {frame.w > 0 && <div className="crop-frame" style={{ width: frame.w, height: frame.h }} />}
              {cropScale > 1.02 && (
                <button
                  type="button"
                  className="crop-zoom"
                  title={d.cropReset}
                  onMouseDown={(ev: any) => ev.stopPropagation()}
                  onClick={resetCrop}
                >
                  {Math.abs(cropScale - Math.round(cropScale)) < 0.05 ? Math.round(cropScale) : cropScale.toFixed(1)}x
                </button>
              )}
            </div>
            <div className="crop-actions">
              <button type="button" className="btn-ghost" onClick={cancelCrop}>{d.adminCancel}</button>
              <button type="button" className="btn-ghost" disabled={uploading} onClick={useOriginalCover}>{d.cropOriginal}</button>
              <button type="button" className="btn btn-primary" disabled={uploading} onClick={confirmCrop}>{d.cropConfirm}</button>
            </div>
          </div>
        </div>
      )}
      <div className="write-settings">
        <div className="write-settings-head">{d.publishSettings}</div>
      <div className="write-row">
        <label className="member-field">
          <span>{d.memberLangLabel}</span>
          <select value={artLocale} onChange={(e) => setArtLocale(e.target.value)}>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="member-field">
          <span>分类</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories
              .filter((c) => c !== "recommend")
              .map((c) => (
                <option key={c} value={c}>
                  {d.categories[c]}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="member-field">
        <span>{d.memberSourcePh}</span>
        <input value={source} maxLength={60} onChange={(e) => setSource(e.target.value)} />
      </label>
      <label className="member-field">
        <span>{d.memberTagsPh}</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="AI, 科技" />
      </label>
      </div>
      {err && <div className="modal-error">{err}</div>}
      <p className="member-muted">+{20} · {d.memberPoints}</p>
      <div className="write-bar">
        <span className="write-bar-info">
          {cloudState === "saving" ? (
            <span className="member-muted">{d.editorSavingCloud}…</span>
          ) : cloudState === "saved" && cloudAt ? (
            <span className="write-saved">{d.editorSavedCloud} · {ago(cloudAt)}</span>
          ) : savedAt ? (
            <span className="write-saved">{d.draftSaved} · {ago(savedAt)}</span>
          ) : (
            <span className="member-muted">{d.editorAutoSave}</span>
          )}
        </span>
        <div className="write-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => requestLeave(`/${locale}/me`)}>
            {d.adminCancel}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => submit("draft")}>
            {d.memberSaveDraft}
          </button>
          <button className="btn-ghost" disabled={busy || !(docId || editId) || docStatus === "published"} onClick={preview}>
            {d.memberPreview}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => submit("publish")}>
            {user?.role === "admin" ? d.memberPublish : d.memberSubmitReview}
          </button>
        </div>
      </div>

      {leaveOpen && (
        <div className="modal-overlay" onClick={() => setLeaveOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{d.editorUnsavedTitle}</div>
            <p className="modal-body">{d.editorUnsavedBody}</p>
            <div className="write-actions">
              <button type="button" className="btn" onClick={() => setLeaveOpen(false)}>
                {d.editorStay}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmLeave}>
                {d.editorLeave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
