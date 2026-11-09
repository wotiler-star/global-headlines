# -*- coding: utf-8 -*-
"""contact_sheet_11h.py — 2026-11h 批次 15 张 Commons 候选目检拼图（3 列 × 5 行九宫格扩展）"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real_11h"
OUT = ROOT / ("contact_11h%s.png" % (sys.argv[1] if len(sys.argv) > 1 else ""))

CELL = (420, 300)
COLS = 3
files = sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.png"))
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * CELL[0], rows * (CELL[1] + 26)), (18, 18, 18))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 15)
except Exception:
    font = ImageFont.load_default()

for i, f in enumerate(files):
    try:
        im = Image.open(f).convert("RGB")
        im.thumbnail(CELL)
    except Exception as e:
        print("  skip %s (%s)" % (f.name, e))
        im = Image.new("RGB", CELL, (60, 30, 30))
    x = (i % COLS) * CELL[0] + (CELL[0] - im.width) // 2
    y = (i // COLS) * (CELL[1] + 26) + (CELL[1] - im.height) // 2
    sheet.paste(im, (x, y))
    ty = (i // COLS) * (CELL[1] + 26) + CELL[1] + 4
    draw.text(((i % COLS) * CELL[0] + 6, ty), f.name, fill=(240, 240, 240), font=font)

sheet.save(OUT)
print("contact sheet:", OUT, sheet.size, len(files), "files")
