# -*- coding: utf-8 -*-
"""fetch_commons_cov48.py — 逐张下载 Commons 真实照片 + 魔法字节校验 + 九宫格目检图

幂等：已成功下载的跳过；遇 429 长冷却后重试，不猛打限流窗口。
"""
import io
import json
import subprocess
import time
import urllib.parse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "brand_real"
OUT.mkdir(exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

data = json.loads((ROOT / "commons_picks_cov48.json").read_text(encoding="utf8"))
PICKS = data["picks"]


def valid(b):
    return len(b) > 5000 and (
        b[:3] == b"\xff\xd8\xff" or b[:4] == b"\x89PNG" or b[:4] == b"GIF8"
    )


def download(title, dest):
    url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
           + urllib.parse.quote(title.replace(" ", "_")) + "?width=2000")
    size = 0
    for attempt in range(3):
        subprocess.run(
            ["curl", "-sSL", "-A", UA, "--max-time", "90", "-o", str(dest), url],
            capture_output=True,
        )
        b = dest.read_bytes() if dest.exists() else b""
        size = len(b)
        if valid(b):
            return True, size
        # 429 / 错误页：先短等，再长冷却（限流窗口别一直顶着）
        time.sleep(20 if attempt == 0 else 95)
    return False, size


for i, (name, title) in enumerate(PICKS.items()):
    dest = OUT / name.replace(".webp", ".jpg")
    if dest.exists() and valid(dest.read_bytes()):
        print(f"SKIP {name} ({dest.stat().st_size} B)", flush=True)
        continue
    ok, size = download(title, dest)
    print(f"{'OK  ' if ok else 'FAIL'} {name} {size} B  <- {title[:56]}", flush=True)
    if i < len(PICKS) - 1:
        time.sleep(12)

# 九宫格目检图（Commons 文件名会说谎，必须看图确认）
sheet = Image.new("RGB", (360 * 3, 360 * 3), (245, 245, 245))
for i, name in enumerate(PICKS):
    p = OUT / name.replace(".webp", ".jpg")
    if not p.exists():
        continue
    try:
        im = Image.open(p).convert("RGB")
        im.thumbnail((360, 360), Image.LANCZOS)
        x = (i % 3) * 360 + (360 - im.width) // 2
        y = (i // 3) * 360 + (360 - im.height) // 2
        sheet.paste(im, (x, y))
    except Exception as e:
        print("缩略失败", name, e, flush=True)
sheet.save(OUT / "contact_sheet.png")
print("[fetch] 九宫格:", OUT / "contact_sheet.png", flush=True)
print("[fetch] 成功数:", sum(
    1 for n in PICKS if (OUT / n.replace(".webp", ".jpg")).exists()
    and valid((OUT / n.replace(".webp", ".jpg")).read_bytes())
), "/", len(PICKS), flush=True)
