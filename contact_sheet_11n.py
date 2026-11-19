# -*- coding: utf-8 -*-
"""contact_sheet_11n.py — 2026-11n 候选原图九宫格/多宫格拼图，供人工目检。

每格带序号与文件名（截断），按文件名排序；每页最多 12 张（4 列 x 3 行）。
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real_11n"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
files = sorted([p for p in SRC.iterdir() if p.suffix.lower() in EXTS and not p.name.endswith(".tmp")])
print("候选原图", len(files), "张")

CW, CH, LABEL = 320, 215, 26
COLS, ROWS = 4, 3
PER = COLS * ROWS
for page in range((len(files) + PER - 1) // PER):
    chunk = files[page * PER:(page + 1) * PER]
    sheet = Image.new("RGB", (COLS * CW, ROWS * (CH + LABEL)), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(chunk):
        idx = page * PER + i
        x, y = (i % COLS) * CW, (i // COLS) * (CH + LABEL)
        try:
            im = Image.open(p).convert("RGB")
            im.thumbnail((CW - 8, CH - 8), Image.LANCZOS)
            sheet.paste(im, (x + (CW - im.width) // 2, y + (CH - im.height) // 2))
        except Exception as e:
            d.text((x + 8, y + 60), "ERR " + str(e)[:30], fill=(180, 0, 0))
        d.text((x + 6, y + CH + 4), "#%02d %s" % (idx, p.name[:40]), fill=(20, 20, 20))
    out = ROOT / ("contact_11n_%d.png" % (page + 1))
    sheet.save(out)
    print("  ->", out.name, "包含", len(chunk), "张")
