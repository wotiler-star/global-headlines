# -*- coding: utf-8 -*-
"""cov56：9 张 Commons 真实照片 → 1200x800 webp；追加 CREDITS；重建完整 imageCredits.ts（旧 18 + 新 9 = 27 条）。
桌面组经目检重排：cover <- fig1.jpg（Dell 工作站），fig1 <- cover.jpg（RGB 暗调）。
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real2"
DST = ROOT / "public" / "original"
CREDITS = DST / "CREDITS.json"
PICKS_FILE = ROOT / "commons_picks_cov56.json"

data = json.loads(PICKS_FILE.read_text(encoding="utf8"))
PICKS, INFO = data["picks"], data["info"]

SRC_FOR = {
    "harmony-desktop-cover.webp": "harmony-desktop-fig1.jpg",
    "harmony-desktop-fig1.webp": "harmony-desktop-cover.jpg",
}


def short_artist(s):
    s = re.sub(r"\s+", " ", (s or "").strip())
    m = re.search(r"user\s+([A-Za-z0-9._\-]+)", s, re.I)
    if m:
        return "Wikimedia Commons user " + m.group(1)
    return s[:48] + ("…" if len(s) > 48 else "")


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


credits = json.loads(CREDITS.read_text(encoding="utf8"))
groups = {}

for name in PICKS:
    src_name = SRC_FOR.get(name, name.replace(".webp", ".jpg"))
    title = PICKS[name]
    src = SRC / src_name
    assert src.exists(), f"缺源文件 {src}"
    out = DST / name
    im = fit(Image.open(src).convert("RGB"))
    im.save(out, "WEBP", quality=88, method=6)
    info = INFO.get(title, {})
    rec = {
        "file": "/original/" + name,
        "source": "Wikimedia Commons",
        "commons_title": "File:" + title,
        "commons_page": info.get("url") or
                        "https://commons.wikimedia.org/wiki/File:" + title.replace(" ", "_"),
        "artist": short_artist(info.get("artist")) or "Wikimedia Commons contributor",
        "license": info.get("license") or "see Commons file page",
        "size_kb": round(out.stat().st_size / 1024),
    }
    key = name.rsplit("-", 1)[0]
    groups.setdefault(key, []).append(rec)
    print(f"  {name:32} <- {src_name:30} | {rec['license']:12} | {rec['artist'][:40]}")

for key, recs in groups.items():
    credits[key] = {"cover": recs[0], "figs": recs[1:]}

CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

lines = [
    "// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）\n",
    "// 数据来源：public/original/CREDITS.json；cov55 起由 build_images_cov55.py 全量重建\n",
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
(ROOT / "src/lib/imageCredits.ts").write_text("".join(lines), encoding="utf8")
print(f"[images] 9 张真实照片落盘；CREDITS 共 {len(credits)} 组 / imageCredits.ts 共 {count} 条署名")
