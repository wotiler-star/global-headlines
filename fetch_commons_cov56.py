# -*- coding: utf-8 -*-
"""fetch_commons_cov56.py — 下载本批 9 张 Commons 真实照片（逐张 13s 间隔，魔法字节校验）"""
import json
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
    "harmony-desktop-cover.jpg": "RGB desktop computer setup with keyboard and monitor.jpg",
    "harmony-desktop-fig1.jpg": "Scientist working with personal computer, 2013 (Dell Precision T3500 Workstation).jpeg",
    "harmony-desktop-fig2.jpg": "A Programmer's Workstation.JPG",
    "oil-membrane-cover.jpg": "Moscow Oil Refinery 01.jpg",
    "oil-membrane-fig1.jpg": "Blue hour fog over Preemraff oil refinery by Brofjorden.jpg",
    "oil-membrane-fig2.jpg": "Night at Valero Refinery in Chalmette Louisiana 02.jpg",
    "chemo-neuro-cover.jpg": "EEG Recording Cap.jpg",
    "chemo-neuro-fig1.jpg": "EEG Experiment.jpg",
    "chemo-neuro-fig2.jpg": "Brain-computer interface experiment.jpg",
}


def magic_ok(p):
    b = p.read_bytes()[:12]
    return (b.startswith(b"\xff\xd8\xff") or b.startswith(b"\x89PNG")
            or b[:4] == b"RIFF" and b[8:12] == b"WEBP")


for local, title in PICKS.items():
    dst = OUT / local
    if dst.exists() and magic_ok(dst) and dst.stat().st_size > 60000:
        print(f"skip {local} (exists)")
        continue
    url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
           + urllib.parse.quote(title) + "?width=2000")
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "120",
                        "-o", str(dst), url], capture_output=True)
    ok = dst.exists() and magic_ok(dst) and dst.stat().st_size > 60000
    print(f"{local:28} {'OK ' if ok else 'FAIL'} {dst.stat().st_size // 1024 if dst.exists() else 0}KB")
    if not ok:
        print(f"  !! 校验失败：{title}")
    time.sleep(13)

print("done")
