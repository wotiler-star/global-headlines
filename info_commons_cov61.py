# -*- coding: utf-8 -*-
"""info_commons_cov61.py — 本批候选图分辨率/许可/作者/文件页（短边 <1500 的淘汰）"""
import json
import re
import subprocess
import time
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

TITLES = [
    # cold
    "File:Laser experiment - Photonics Laboratory - Physics Department - Ateneo de Manila University.jpg",
    "File:Bose-Einstein condensate, a cloud of super-cooled Rubidium atoms in a Laser trap on an Optical table - In a game of catch & release, the atoms will shoot up a 30 ft. tall Atomic fountain - Stanford.jpg",
    "File:USNO rubidium fountain.jpg",
    "File:Atomic Fountain.jpg",
    "File:NIST F2 Cesium atomic clock.jpg",
    "File:Usno-fountain-lasertable.jpg",
    "File:Laser Optics - Idaho National Laboratory.jpg",
    "File:RbMetal.JPG",
    "File:Bose-Einstein Condensate (5941063056).jpg",
    # tablet
    "File:IPad 4, model A1458-0869.jpg",
    "File:Tablet computer.jpg",
    "File:Tablet hands.jpg",
    "File:Apple iPad 2 closeup.jpg",
    "File:Pixels 20211026 184942.jpg",
    "File:NEXUS 5-pixel pattern PNr°0409.jpg",
    "File:IMac M4 2024 2 (cropped).jpg",
    "File:24 inch iMac monitor.jpeg",
    # fossil
    "File:Theropod Skeleton (36094776020).jpg",
    "File:Tyrannosaurus rex (theropod dinosaur) (Hell Creek Formation, Upper Cretaceous; near Faith, South Dakota, USA) 33.jpg",
    "File:Deltadromeus excavation.jpg",
    "File:Somosaguas fossil site - 2014 paleontological campaign 03.JPG",
    "File:Scanning electron microscope - UFCH JH (2020) 01.jpg",
    "File:Scientist during work with Scanning Electron Microscope.jpg",
    "File:Saurolophus excavation.jpg",
]

for i in range(0, len(TITLES), 5):
    batch = TITLES[i:i + 5]
    url = API + "?" + urllib.parse.urlencode({
        "action": "query", "prop": "imageinfo",
        "iiprop": "size|extmetadata|url",
        "titles": "|".join(batch), "format": "json",
    })
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "45", url], capture_output=True)
    try:
        d = json.loads(r.stdout.decode("utf8", "replace"))
    except Exception:
        print("batch parse fail", i, flush=True)
        continue
    for page in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (page.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {}) or {}
        lic = (em.get("LicenseShortName", {}) or {}).get("value", "?")
        artist = re.sub(r"<[^>]+>", "", (em.get("Artist", {}) or {}).get("value", "?"))[:70]
        w, h = ii.get("width", 0), ii.get("height", 0)
        flag = "OK " if min(w, h) >= 1500 else "LOW"
        print(f"{flag} {w}x{h} | {lic:16} | {page.get('title','?')[:88]} | {artist}", flush=True)
    time.sleep(2)
