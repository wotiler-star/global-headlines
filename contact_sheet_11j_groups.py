# -*- coding: utf-8 -*-
"""contact_sheet_11j_groups.py — 按主题分 3 张拼图，单格更大便于目检主体"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SRC = ROOT / "brand_real_11j"
GROUPS = ["photonic-memristor", "lipid-chain-aging", "hotel-content-economy"]
CELL = (560, 400)
COLS = 3
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 17)
except Exception:
    font = ImageFont.load_default()

for g in GROUPS:
    files = sorted([p for p in SRC.iterdir() if p.name.startswith(g) and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")])
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL[0], rows * (CELL[1] + 32)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        try:
            im = Image.open(f).convert("RGB")
            im.thumbnail(CELL)
        except Exception as e:
            print("skip", f.name, e)
            im = Image.new("RGB", CELL, (70, 30, 30))
        x = (i % COLS) * CELL[0] + (CELL[0] - im.width) // 2
        y = (i // COLS) * (CELL[1] + 32) + (CELL[1] - im.height) // 2
        sheet.paste(im, (x, y))
        ty = (i // COLS) * (CELL[1] + 32) + CELL[1] + 6
        draw.text(((i % COLS) * CELL[0] + 8, ty), f.name, fill=(245, 245, 245), font=font)
    out = ROOT / ("contact_11j_%s.png" % g)
    sheet.save(out)
    print(out, sheet.size, len(files), "files")
