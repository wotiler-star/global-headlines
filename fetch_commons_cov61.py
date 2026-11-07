# -*- coding: utf-8 -*-
"""fetch_commons_cov61.py — 本批 Commons 真实照片下载（UA + 逐张 13s 间隔 + 魔法字节校验）。
9 张正选 + 6 张备选，目检后由 build_images_cov61.py 定稿。
"""
import subprocess
import time
import urllib.parse
from pathlib import Path

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
OUT = ROOT / "brand_real2"
OUT.mkdir(exist_ok=True)

PICKS = {
    # 超冷原子
    "ultracold-space-cover.jpg": "Bose-Einstein condensate, a cloud of super-cooled Rubidium atoms in a Laser trap on an Optical table - In a game of catch & release, the atoms will shoot up a 30 ft. tall Atomic fountain - Stanford.jpg",
    "ultracold-space-fig1.jpg": "Atomic Fountain.jpg",
    "ultracold-space-fig2.jpg": "Laser experiment - Photonics Laboratory - Physics Department - Ateneo de Manila University.jpg",
    "ultracold-space-alt1.jpg": "Laser Optics - Idaho National Laboratory.jpg",
    "ultracold-space-alt2.jpg": "RbMetal.JPG",
    # 平板 / 消费电子
    "oled-ipad-mini-cover.jpg": "IPad 4, model A1458-0869.jpg",
    "oled-ipad-mini-fig1.jpg": "Tablet computer.jpg",
    "oled-ipad-mini-fig2.jpg": "IMac M4 2024 2 (cropped).jpg",
    "oled-ipad-mini-alt1.jpg": "Apple iPad 2 closeup.jpg",
    "oled-ipad-mini-alt2.jpg": "Pixels 20211026 184942.jpg",
    # 恐龙化石
    "dino-heme-cover.jpg": "Theropod Skeleton (36094776020).jpg",
    "dino-heme-fig1.jpg": "Saurolophus excavation.jpg",
    "dino-heme-fig2.jpg": "Scanning electron microscope - UFCH JH (2020) 01.jpg",
    "dino-heme-alt1.jpg": "Tyrannosaurus rex (theropod dinosaur) (Hell Creek Formation, Upper Cretaceous; near Faith, South Dakota, USA) 33.jpg",
    "dino-heme-alt2.jpg": "Scientist during work with Scanning Electron Microscope.jpg",
}


def magic_ok(p):
    b = p.read_bytes()[:12]
    return (b.startswith(b"\xff\xd8\xff") or b.startswith(b"\x89PNG")
            or (b[:4] == b"RIFF" and b[8:12] == b"WEBP"))


for local, title in PICKS.items():
    dst = OUT / local
    if dst.exists() and magic_ok(dst) and dst.stat().st_size > 60000:
        print(f"skip {local} (exists, {dst.stat().st_size//1024}KB)", flush=True)
        continue
    url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
           + urllib.parse.quote(title) + "?width=2000")
    for attempt in range(3):
        subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "150",
                        "-o", str(dst), url], capture_output=True)
        ok = dst.exists() and magic_ok(dst) and dst.stat().st_size > 60000
        if ok:
            break
        print(f"  retry {attempt+1}: {local}", flush=True)
        time.sleep(20)
    kb = dst.stat().st_size // 1024 if dst.exists() else 0
    print(f"{local:34} {'OK ' if ok else 'FAIL'} {kb}KB", flush=True)
    time.sleep(13)

print("[fetch] done", flush=True)
