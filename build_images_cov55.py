# -*- coding: utf-8 -*-
"""cov55：9 张 Commons 真实照片 → 1200x800 webp；追加 CREDITS；重建完整 imageCredits.ts。
与 cov48 的区别：不覆盖旧署名，imageCredits.ts 由完整 CREDITS.json 重建（旧 9 + 新 9 = 18 条）。
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real2"
DST = ROOT / "public" / "original"
CREDITS = DST / "CREDITS.json"
PICKS_FILE = ROOT / "commons_picks_cov55.json"

data = json.loads(PICKS_FILE.read_text(encoding="utf8"))
PICKS, INFO = data["picks"], data["info"]

# 目检后调整 6G 组顺序：天线阵列仰拍做封面，塔架做配图，远景小镇对应覆盖话题
SRC_FOR = {
    "6g-prototype-cover.webp": "6g-prototype-fig1.jpg",
    "6g-prototype-fig1.webp": "6g-prototype-fig2.jpg",
    "6g-prototype-fig2.webp": "6g-prototype-cover.jpg",
}
TITLE_FOR = {
    "6g-prototype-cover.webp": "Cell tower antenna, Zagrebačka cesta.jpg",
    "6g-prototype-fig1.webp": "Zoomed in shot of mobile phone mast.jpg",
    "6g-prototype-fig2.webp": "Cell Tower in Stykkishólmur.jpg",
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
    title = TITLE_FOR.get(name, PICKS[name])
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
    print(f"  {name:32} <- {src_name:30} | {rec['license']:14} | {rec['artist'][:38]}")

for key, recs in groups.items():
    credits[key] = {"cover": recs[0], "figs": recs[1:]}

CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

# 从完整 CREDITS 重建前端署名映射，确保旧 9 张署名不被覆盖
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
