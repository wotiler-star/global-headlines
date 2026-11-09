# -*- coding: utf-8 -*-
"""build_images_11h.py — 2026-11h 的 9 张 Commons 真实照片 → 1200x800 webp；
追加 CREDITS 3 组（共 21 组）；从完整 CREDITS 全量重建 imageCredits.ts（保留历史署名）。
目检后如需重排角色，只改 SRC_FOR（webp 名 -> 源文件名）。
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real_11h"
DST = ROOT / "public" / "original"
CREDITS = DST / "CREDITS.json"
PICKS = json.loads((ROOT / "commons_picks_11h.json").read_text(encoding="utf8"))

# webp 名 -> 源文件名（两轮九宫格目检后定稿）
# 弃用：long-livephoto-cover.jpg（带蓝黄标注框的示意图，非自然照片）、
#       gut-nad-precursor-cover.jpg（培养皿细菌艺术画，设计感摆拍且主体名不符实）、
#       long-livephoto-fig2.jpg（沙滩凉鞋为主体，手机过小）。
# 替换：肠道封面用结肠组织切片、fig2 用果蝇培养瓶（呼应文中果蝇示踪）；
#       手机封面用美术馆举手机拍照的真实场景、fig2 用桌面手拿手机。
SRC_FOR = {
    "solar-flare-field-cover.webp": "solar-flare-field-cover.jpg",
    "solar-flare-field-fig1.webp": "solar-flare-field-fig1.jpg",
    "solar-flare-field-fig2.webp": "solar-flare-field-fig2.jpg",
    "gut-nad-precursor-cover.webp": "gut-nad-precursor-fig1.jpg",
    "gut-nad-precursor-fig1.webp": "gut-nad-precursor-fig2.jpg",
    "gut-nad-precursor-fig2.webp": "gut-nad-precursor-alt2.jpg",
    "long-livephoto-cover.webp": "long-livephoto-alt5.jpg",
    "long-livephoto-fig1.webp": "long-livephoto-fig1.jpg",
    "long-livephoto-fig2.webp": "long-livephoto-alt4.jpg",
}


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


credits = json.loads(CREDITS.read_text(encoding="utf8"))
assert len(credits) == 18, "基线 CREDITS 应为 18 组，实际 %d" % len(credits)
groups = {}
for name, src_name in SRC_FOR.items():
    src = SRC / src_name
    assert src.exists(), "缺源文件 %s" % src
    out = DST / name
    fit(Image.open(src).convert("RGB")).save(out, "WEBP", quality=88, method=6)
    info = PICKS[src_name]
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
    print("  %-30s <- %-44s | %-14s | %s" % (
        name, src_name, rec["license"], rec["artist"][:34]))

for key, recs in groups.items():
    credits[key] = {"cover": recs[0], "figs": recs[1:]}

CREDITS.write_bytes((json.dumps(credits, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

lines = [
    "// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）\n",
    "// 数据来源：public/original/CREDITS.json；全量重建，保留历史批次署名\n",
    "export type ImageCredit = { artist: string; license: string; url: string };\n\n",
    "export const IMAGE_CREDITS: Record<string, ImageCredit> = {\n",
]
count = 0
for group in credits.values():
    for r in [group["cover"]] + list(group.get("figs", [])):
        artist = r["artist"].replace("\\", "\\\\").replace('"', '\\"')
        url = r["commons_page"].replace("\\", "\\\\").replace('"', '\\"')
        lic = r["license"].replace('"', '\\"')
        lines.append('  "%s": { artist: "%s", license: "%s", url: "%s" },\n' % (r["file"], artist, lic, url))
        count += 1
lines.append("};\n")
(ROOT / "src/lib/imageCredits.ts").write_bytes("".join(lines).encode("utf8"))
print("[images 11h] 9 张落盘；CREDITS %d 组 / imageCredits.ts %d 条" % (len(credits), count))
