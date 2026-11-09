# -*- coding: utf-8 -*-
"""fix_bad_images_11h.py — 替换 2 张劣质图（用户 2026-11-09 明确要求）
 1) oled-ipad-mini-cover.webp  灰色划痕玻璃（主体不明） -> Sony Tablet S 木桌产品照
 2) solar-flare-field-fig1.webp 纯红圆盘 9KB（零细节） -> McMath-Pierce 太阳望远镜+星轨
webp 文件名不变（文章 JSON 无需改路径），同步 CREDITS / imageCredits.ts / og 图。
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

REPLACE = {
    "oled-ipad-mini-cover.webp": "oled-repl-d.jpg",
    "solar-flare-field-fig1.webp": "solar-flare-field-alt1.jpg",
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
    return im.resize((w, h), Image.LANCZOS)


credits = json.loads(CREDITS.read_text(encoding="utf8"))
assert len(credits) == 21, "CREDITS 应为 21 组"

for webp, src_name in REPLACE.items():
    src = SRC / src_name
    assert src.exists(), "缺源文件 %s" % src
    out = DST / webp
    fit(Image.open(src).convert("RGB")).save(out, "WEBP", quality=88, method=6)
    info = PICKS[src_name]
    rec = {
        "file": "/original/" + webp,
        "source": "Wikimedia Commons",
        "commons_title": info["title"],
        "commons_page": info["commons_page"],
        "artist": short_artist(info.get("artist")) or "Wikimedia Commons contributor",
        "license": info.get("license") or "see Commons file page",
        "size_kb": round(out.stat().st_size / 1024),
    }
    slug = webp.replace("-cover.webp", "").replace("-fig1.webp", "").replace("-fig2.webp", "")
    g = credits[slug]
    if webp.endswith("-cover.webp"):
        g["cover"] = rec
    else:
        idx = 1 if "-fig1" in webp else 2
        g["figs"][idx - 1] = rec
    print("  %-34s <- %-32s | %-14s | %s | %dKB"
          % (webp, src_name, rec["license"], rec["artist"][:30], rec["size_kb"]))

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

# 重新生成受影响 2 个 slug 的 1.91:1 分享图
W, H = 1200, 630
for slug in ["oled-ipad-mini", "solar-flare-field"]:
    f = DST / (slug + "-cover.webp")
    if not f.exists():
        continue
    o = ROOT / "public" / "og" / (slug + ".jpg")
    im = Image.open(f).convert("RGB")
    sw, sh = im.size
    scale = max(W / sw, H / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    if (nw, nh) != (sw, sh):
        im = im.resize((nw, nh), Image.LANCZOS)
    im = im.crop(((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H))
    im.save(o, "JPEG", quality=88, optimize=True, progressive=True)
    print("  og %-28s %dKB" % (o.name, o.stat().st_size // 1024))

print("[fix] 2 张劣质图已替换；CREDITS %d 组 / imageCredits.ts %d 条" % (len(credits), count))
