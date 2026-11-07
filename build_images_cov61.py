# -*- coding: utf-8 -*-
"""build_images_cov61.py — 本批 9 张 Commons 真实照片 → 1200x800 webp；
追加 CREDITS 3 组；从完整 CREDITS 全量重建 imageCredits.ts（保留历史批次署名，含 11d）。
目检后如需重排角色，改 SRC_FOR（webp 名 -> 源 jpg 名）。
"""
import json
import re
import urllib.parse
from pathlib import Path
from PIL import Image

from commons_picks_cov61 import PICKS, INFO

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real2"
DST = ROOT / "public" / "original"
CREDITS = DST / "CREDITS.json"

# 九宫格目检后在此重排（例如封面换成 alt1）
SRC_FOR = {
    # 九宫格目检：原 fig2 绿光打岩石主体偏暗，换明亮激光实验室实拍
    "ultracold-space-fig2.webp": "ultracold-space-alt1.jpg",
    # 原 fig1 为黑白发掘照、主体模糊，换高清恐龙头骨特写
    "dino-heme-fig1.webp": "dino-heme-alt1.jpg",
}


def short_artist(s):
    s = re.sub(r"\s+", " ", (s or "").strip())
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
        print(f"  !! 源图裁后 {im.size} 小于 {w}x{h}，会放大：请换高清图")
    return im.resize((w, h), Image.LANCZOS)


def commons_page(title):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(
        title.replace(" ", "_"), safe="()_',-.")


credits = json.loads(CREDITS.read_text(encoding="utf8"))
groups = {}

for name, title in PICKS.items():
    src_name = SRC_FOR.get(name, name.replace(".webp", ".jpg"))
    src = SRC / src_name
    assert src.exists(), f"缺源文件 {src}"
    out = DST / name
    im = fit(Image.open(src).convert("RGB"))
    im.save(out, "WEBP", quality=88, method=6)
    # 若重排，Commons 标题应跟源图走
    real_title = src_name.replace(".jpg", "")
    title_by_src = {v.replace(".webp", ".jpg"): t for v, t in PICKS.items()}
    if src_name in title_by_src:
        real_title = title_by_src[src_name]
    else:
        real_title = {
            "ultracold-space-alt1.jpg": "Laser Optics - Idaho National Laboratory.jpg",
            "ultracold-space-alt2.jpg": "RbMetal.JPG",
            "oled-ipad-mini-alt1.jpg": "Apple iPad 2 closeup.jpg",
            "oled-ipad-mini-alt2.jpg": "Pixels 20211026 184942.jpg",
            "dino-heme-alt1.jpg": "Tyrannosaurus rex (theropod dinosaur) (Hell Creek Formation, Upper Cretaceous; near Faith, South Dakota, USA) 33.jpg",
            "dino-heme-alt2.jpg": "Scientist during work with Scanning Electron Microscope.jpg",
        }.get(src_name, title)
    info = INFO.get(real_title, {})
    rec = {
        "file": "/original/" + name,
        "source": "Wikimedia Commons",
        "commons_title": "File:" + real_title,
        "commons_page": commons_page(real_title),
        "artist": short_artist(info.get("artist")) or "Wikimedia Commons contributor",
        "license": info.get("license") or "see Commons file page",
        "size_kb": round(out.stat().st_size / 1024),
    }
    key = name.rsplit("-", 1)[0]
    groups.setdefault(key, []).append(rec)
    print(f"  {name:32} <- {src_name:30} | {rec['license']:16} | {rec['artist'][:36]}")

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
    recs = [group["cover"]] + list(group.get("figs", []))
    for r in recs:
        artist = r["artist"].replace("\\", "\\\\").replace('"', '\\"')
        url = r["commons_page"].replace("\\", "\\\\").replace('"', '\\"')
        license_ = r["license"].replace('"', '\\"')
        lines.append(f'  "{r["file"]}": {{ artist: "{artist}", license: "{license_}", url: "{url}" }},\n')
        count += 1
lines.append("};\n")
(ROOT / "src/lib/imageCredits.ts").write_bytes("".join(lines).encode("utf8"))
print(f"[images] 9 张真实照片落盘；CREDITS 共 {len(credits)} 组 / imageCredits.ts 共 {count} 条署名")
