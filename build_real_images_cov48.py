# -*- coding: utf-8 -*-
"""build_real_images_cov48.py — 把 9 张 Commons 真实照片转成 webp 覆盖线上图片，并重写 CREDITS"""
import json
import re
from pathlib import Path
from PIL import Image


def short_artist(s):
    """Commons 的 Artist 字段常是一整段授权说明，提取真实用户名或截断。"""
    s = re.sub(r"\s+", " ", (s or "").strip())
    m = re.search(r"user\s+([A-Za-z0-9._\-]+)", s, re.I)
    if m:
        return "Wikimedia Commons user " + m.group(1)
    return s[:48] + ("…" if len(s) > 48 else "")

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "brand_real"
DST = ROOT / "public/original"
CREDITS = DST / "CREDITS.json"

data = json.loads((ROOT / "commons_picks_cov48.json").read_text(encoding="utf8"))
PICKS, INFO = data["picks"], data["info"]

credits = json.loads(CREDITS.read_text(encoding="utf8"))


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


groups = {}
for name, title in PICKS.items():
    src = SRC / name.replace(".webp", ".jpg")
    out = DST / name
    im = fit(Image.open(src).convert("RGB"))
    im.save(out, "WEBP", quality=88, method=6)
    info = INFO.get(title, {})
    rec = {
        "file": "/original/" + name,
        "source": "Wikimedia Commons",
        "commons_title": "File:" + title,
        "commons_page": info.get("url", "https://commons.wikimedia.org/wiki/File:" + title.replace(" ", "_")),
        "artist": short_artist(info.get("artist")) or "Wikimedia Commons contributor",
        "license": info.get("license") or "see Commons file page",
        "size_kb": round(out.stat().st_size / 1024),
    }
    key = name.rsplit("-", 1)[0]  # spatial-glasses / edge-ai-chip / car-ai
    groups.setdefault(key, []).append(rec)
    print(f"  {name:34} <- {title[:48]:48} | {rec['license']} | {rec['artist'][:38]}")

for key, recs in groups.items():
    credits[key] = {"cover": recs[0], "figs": recs[1:]}

# 移除早期原创稿（已从文章库删除）遗留的 AI 生成图条目
for old in ["chogm", "opensource", "ciie"]:
    credits.pop(old, None)

CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

# 供前端署名渲染使用的静态映射（避免 24 篇多语稿重复存同一份来源数据）
lines = [
    "// cov48：Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）\n",
    "// 数据来源：public/original/CREDITS.json，由 build_real_images_cov48.py 生成\n",
    "export type ImageCredit = { artist: string; license: string; url: string };\n\n",
    "export const IMAGE_CREDITS: Record<string, ImageCredit> = {\n",
]
for recs in groups.values():
    for r in recs:
        artist = r["artist"].replace("\\", "\\\\").replace('"', '\\"')
        url = r["commons_page"].replace("\\", "\\\\").replace('"', '\\"')
        license_ = r["license"].replace('"', '\\"')
        lines.append(f'  "{r["file"]}": {{ artist: "{artist}", license: "{license_}", url: "{url}" }},\n')
lines.append("};\n")
(ROOT / "src/lib/imageCredits.ts").write_text("".join(lines), encoding="utf8")
print("[images] 9 张真实照片已落盘；CREDITS 与 imageCredits.ts 已更新")
