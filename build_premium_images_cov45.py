# -*- coding: utf-8 -*-
"""把 cov45 生成的 9 张 PNG 转成 webp 并按文章重命名，落到 public/original/"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "brand_images"
DST = ROOT / "public/original"
DST.mkdir(parents=True, exist_ok=True)

MAP = {
    "10-05-35": "spatial-glasses-cover.webp",
    "10-07-14": "spatial-glasses-fig1.webp",
    "10-08-20": "spatial-glasses-fig2.webp",
    "10-09-03": "edge-ai-chip-cover.webp",
    "10-09-40": "edge-ai-chip-fig1.webp",
    "10-10-09": "edge-ai-chip-fig2.webp",
    "10-11-01": "car-ai-cover.webp",
    "10-11-33": "car-ai-fig1.webp",
    "10-12-57": "car-ai-fig2.webp",
}

files = list(SRC.glob("*.png"))
print("源 PNG 数:", len(files))
done = set()
for f in files:
    for key, name in MAP.items():
        if key in f.name and name not in done:
            im = Image.open(f).convert("RGB")
            w = 1200 if "-cover" in name else 900
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            im.save(DST / name, "WEBP", quality=88, method=6)
            done.add(name)
            print(f"  {f.name[:42]} -> {name} {im.size}")
            break
missing = set(MAP.values()) - done
if missing:
    raise SystemExit(f"缺少映射: {missing}")
print(f"[images] 完成 {len(done)}/9")
