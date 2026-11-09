# -*- coding: utf-8 -*-
"""gen-og-images.py — 从 public/original/*-cover.webp 生成社交分享专用的 1200x630 JPG。

为什么要单独一套图：
1) OG / Twitter 卡片推荐 1.91:1（1200x630），线上原封面是 1200x800（3:2），
   在部分平台会被二次裁切，分享卡片主体容易偏；
2) webp 在部分社交平台（尤其 WhatsApp / LinkedIn / 部分国内客户端）抓取不稳，
   JPG 兼容性最好。
3) 文章页 metadata 会优先取 /og/<slug>.jpg，若文件不存在自动回退原 webp，
   因此新增批次后忘记跑本脚本也不会产生 404。

用法：python scripts/gen-og-images.py
每新增一批原创稿（3 个新 slug）后在本地跑一次，并把 public/og/ 随部署 scp 上线。
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "original"
DST = ROOT / "public" / "og"
W, H = 1200, 630
DST.mkdir(parents=True, exist_ok=True)

count = 0
for f in sorted(SRC.glob("*-cover.webp")):
    slug = f.name[: -len("-cover.webp")]
    out = DST / f"{slug}.jpg"
    im = Image.open(f).convert("RGB")
    sw, sh = im.size
    # 先等比缩放到能覆盖 1200x630，再居中裁切（原图已是 1200x800 居中构图）
    scale = max(W / sw, H / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    if (nw, nh) != (sw, sh):
        im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    count += 1
    print(f"{out.name}  {sw}x{sh} -> {W}x{H}  {out.stat().st_size} bytes")

print(f"[og] generated {count} images -> {DST}")
