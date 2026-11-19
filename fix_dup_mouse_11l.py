# -*- coding: utf-8 -*-
"""fix_dup_mouse_11l.py — slow-dopamine-taste-fig2 与 lipid-chain-aging-fig2 重复（同一张 Lab mouse）。
换用 Commons 候选 "Black coffee on wooden table outdoors. (51528275111).jpg" (CC BY 2.0)，
转码覆盖 fig2，同步 CREDITS.json 与 imageCredits.ts。
"""
import json
import hashlib
import re
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
DST = ROOT / "public" / "original"
SRC_DIR = ROOT / "brand_real_11l"

# Wikimedia 对本 IP 限流，改用本地已下载但未启用的候选源图
# slow-dopamine-taste-01.jpg = "File:Black coffee on wooden table outdoors. (51528275111).jpg" (CC BY 2.0)
SRC_DIR / "slow-dopamine-taste-01.jpg"  # noqa
raw_path = SRC_DIR / "slow-dopamine-taste-01.jpg"


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
    return im.resize((w, h), Image.LANCZOS)


out = DST / "slow-dopamine-taste-fig2.webp"
with Image.open(raw_path) as raw:
    fit(raw.convert("RGB")).save(out, "WEBP", quality=88, method=6)
print("saved", out.name, out.stat().st_size, "bytes")

PAGE = "https://commons.wikimedia.org/wiki/File:Black_coffee_on_wooden_table_outdoors._(51528275111).jpg"
TITLE = "File:Black coffee on wooden table outdoors. (51528275111).jpg"
ARTIST = "Nenad Stojkovic"
LICENSE = "CC BY 2.0"

# 1) CREDITS.json
credits_path = DST / "CREDITS.json"
credits = json.loads(credits_path.read_text(encoding="utf8"))
rec = {
    "file": "/original/slow-dopamine-taste-fig2.webp",
    "source": "Wikimedia Commons",
    "commons_title": TITLE,
    "commons_page": PAGE,
    "artist": ARTIST,
    "license": LICENSE,
    "size_kb": round(out.stat().st_size / 1024),
}
credits["slow-dopamine-taste"]["figs"][1] = rec
credits_path.write_bytes((json.dumps(credits, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
print("CREDITS.json updated")

# 2) imageCredits.ts
ts_path = ROOT / "src" / "lib" / "imageCredits.ts"
ts = ts_path.read_text(encoding="utf8")
old_line = re.search(r'^\s*"/original/slow-dopamine-taste-fig2\.webp": \{.*\},?\s*$',
                     ts, re.M)
assert old_line, "imageCredits.ts 未找到旧条目"
new_line = ('  "/original/slow-dopamine-taste-fig2.webp": '
            '{ artist: "%s", license: "%s", url: "%s" },\n' % (ARTIST, LICENSE, PAGE))
ts = ts.replace(old_line.group(0), new_line.rstrip("\n"))
ts_path.write_bytes(ts.encode("utf8"))
print("imageCredits.ts updated")

# 3) 全量 md5 去重校验
md5s = {}
dups = []
for f in sorted(DST.glob("*.webp")):
    h = hashlib.md5(f.read_bytes()).hexdigest()
    if h in md5s:
        dups.append((md5s[h], f.name))
    md5s[h] = f.name
print("webp files:", len(md5s), "duplicate pairs:", dups if dups else "NONE")
assert not dups, "仍有重复图！"
print("OK")
