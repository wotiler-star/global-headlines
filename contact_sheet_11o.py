# -*- coding: utf-8 -*-
"""contact_sheet_11o.py — 11o 候选原图拼图，供目检。按主题分组，每页一组。"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(".")
SRC = ROOT / "brand_real_11o"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
GROUPS = ["chip-voyage", "container-cargo", "crossborder-decade", "smart-port", "oem-to-brand"]

CW, CH, LABEL = 360, 240, 28
COLS = 3
for g in GROUPS:
    files = sorted([p for p in SRC.iterdir() if p.name.startswith(g + "-") and p.suffix.lower() in EXTS and not p.name.endswith(".tmp")])
    if not files:
        print(f"{g}: 无图，跳过")
        continue
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CW, rows * (CH + LABEL)), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(files):
        x, y = (i % COLS) * CW, (i // COLS) * (CH + LABEL)
        try:
            im = Image.open(p).convert("RGB")
            im.thumbnail((CW - 8, CH - 8), Image.LANCZOS)
            sheet.paste(im, (x + (CW - im.width) // 2, y + (CH - im.height) // 2))
        except Exception as e:
            d.text((x + 8, y + 60), "ERR " + str(e)[:30], fill=(180, 0, 0))
        d.text((x + 6, y + CH + 4), p.name[:42], fill=(20, 20, 20))
    out = ROOT / ("contact_11o_%s.png" % g)
    sheet.save(out)
    print(f"  -> {out.name} ({len(files)} 张)")
