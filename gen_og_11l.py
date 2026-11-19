# -*- coding: utf-8 -*-
"""gen_og_11l.py — 只为 2026-11l 的 3 个新 slug 生成 1200x630 社交分享 JPG。

不覆盖历史 og 图（保持本地与服务器 og 目录一致，只多这 3 张）。
"""
from pathlib import Path
from PIL import Image

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "public" / "original"
DST = ROOT / "public" / "og"
DST.mkdir(parents=True, exist_ok=True)
SLUGS = ["ai-shopping-agent", "perovskite-ai-screening", "slow-dopamine-taste"]
W, H = 1200, 630

for slug in SLUGS:
    f = SRC / f"{slug}-cover.webp"
    assert f.exists(), "缺封面 " + str(f)
    im = Image.open(f).convert("RGB")
    sw, sh = im.size
    scale = max(W / sw, H / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    if (nw, nh) != (sw, sh):
        im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    out = DST / f"{slug}.jpg"
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(out.name, f"{sw}x{sh} -> {W}x{H}", out.stat().st_size, "bytes")
print("[og 11l] 3 张生成完成")
