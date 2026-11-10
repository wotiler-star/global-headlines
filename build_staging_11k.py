# -*- coding: utf-8 -*-
"""build_staging_11k.py — 把九宫格目检定稿的 9 张 Commons 真实照片转成 1200x800 webp，
只落到 staging/2026-11k/public/original/（不触碰共享的 public/original、CREDITS.json、
imageCredits.ts）。同时生成 CREDITS_new.json（3 组，下轮合并用）并复制质量门禁脚本，
便于对归档图片单独跑 image_quality_gate.py。
"""
import json
import re
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
STAGE = ROOT / "staging" / "2026-11k"
SRC = ROOT / "brand_real_11j"
DST = STAGE / "public" / "original"
DST.mkdir(parents=True, exist_ok=True)

DOWNLOADS = json.loads((ROOT / "downloads_11j.json").read_text(encoding="utf8"))
SRC_FOR = json.loads((ROOT / "src_for_11k.json").read_text(encoding="utf8"))


def short_artist(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    m = re.search(r"user\s+([A-Za-z0-9._\-]+)", s, re.I)
    if m:
        return "Wikimedia Commons user " + m.group(1)
    return s[:60] + ("…" if len(s) > 60 else "")


def fit(im, w=1200, h=800):
    ratio = w / h
    iw, ih = im.size
    if iw / ih > ratio:
        nw = int(ih * ratio)
        left = (iw - nw) // 2
        im = im.crop((left, 0, left + nw, ih))
    else:
        nh = int(iw / ratio)
        top = (ih - nh) // 2
        im = im.crop((0, top, iw, top + nh))
    if min(im.size) < min(w, h):
        print("  !! 源图裁后 %s 小于 %dx%d，会放大：请换高清图" % (im.size, w, h))
    return im.resize((w, h), Image.LANCZOS)


assert len(SRC_FOR) == 9, "角色映射应为 9 张，实际 %d" % len(SRC_FOR)
groups = {}
for name, src_name in SRC_FOR.items():
    src = SRC / src_name
    assert src.exists(), "缺源文件 %s" % src
    info = DOWNLOADS.get(src_name)
    assert info, "缺元数据 %s" % src_name
    out = DST / name
    with Image.open(src) as raw:
        fit(raw.convert("RGB")).save(out, "WEBP", quality=88, method=6)
    rec = {
        "file": "/original/" + name,
        "source": "Wikimedia Commons",
        "commons_title": info["title"],
        "commons_page": info["commons_page"],
        "artist": short_artist(info.get("artist")) or "Wikimedia Commons contributor",
        "license": info.get("license") or "see Commons file page",
        "size_kb": round(out.stat().st_size / 1024),
    }
    key = name.replace("-cover.webp", "").replace("-fig1.webp", "").replace("-fig2.webp", "")
    groups.setdefault(key, []).append(rec)
    print("  %-34s <- %-38s | %-14s | %s" % (
        name, src_name, rec["license"], rec["artist"][:34]))

for key, recs in groups.items():
    assert len(recs) == 3, "%s 应有 3 张，实际 %d" % (key, len(recs))
credits_new = {k: {"cover": v[0], "figs": v[1:]} for k, v in groups.items()}
(STAGE / "CREDITS_new.json").write_bytes(
    (json.dumps(credits_new, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

# 复制门禁脚本到 staging 根：其 ROOT=脚本目录，DST=ROOT/public/original，正好扫这 9 张
shutil.copy2(ROOT / "image_quality_gate.py", STAGE / "image_quality_gate.py")
print("[build_staging_11k] 9 张落盘 + CREDITS_new.json %d 组 + 门禁脚本就位" % len(credits_new))
