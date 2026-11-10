# -*- coding: utf-8 -*-
"""build_images_11j.py — 2026-11j 的 9 张 Commons 真实照片 → 1200x800 webp；
追加 CREDITS 3 组（24 → 27 组）；从完整 CREDITS 全量重建 imageCredits.ts（保留历史署名）。
角色映射在 src_for_11j.json（九宫格目检后定稿），元数据在 downloads_11j.json。
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real_11j"
DST = ROOT / "public" / "original"
CREDITS = DST / "CREDITS.json"
DOWNLOADS = json.loads((ROOT / "downloads_11j.json").read_text(encoding="utf8"))
SRC_FOR = json.loads((ROOT / "src_for_11j.json").read_text(encoding="utf8"))


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
assert len(credits) == 24, "基线 CREDITS 应为 24 组，实际 %d" % len(credits)
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
print("[images 11j] 9 张落盘；CREDITS %d 组 / imageCredits.ts %d 条" % (len(credits), count))
