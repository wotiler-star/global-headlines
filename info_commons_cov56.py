# -*- coding: utf-8 -*-
"""info_commons_cov56.py — 候选图的分辨率/许可/作者/文件页"""
import json
import subprocess
import time
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

TITLES = [
    # desktop
    "File:RGB desktop computer setup with keyboard and monitor.jpg",
    "File:A Programmer's Workstation.JPG",
    "File:Scientist working with personal computer, 2013 (Dell Precision T3500 Workstation).jpeg",
    "File:NVIDIA GPU workstation 2.webp",
    # refinery
    "File:Anacortes Refinery 31911.JPG",
    "File:Blue hour fog over Preemraff oil refinery by Brofjorden.jpg",
    "File:Night at Valero Refinery in Chalmette Louisiana 02.jpg",
    "File:Moscow Oil Refinery 01.jpg",
    "File:Oil refinery, Port Dickson.jpg",
    # brain
    "File:EEG cap.jpg",
    "File:EEG Recording Cap.jpg",
    "File:Brain-computer interface experiment.jpg",
    "File:EEG Experiment.jpg",
]

for i in range(0, len(TITLES), 5):
    batch = TITLES[i:i + 5]
    url = API + "?" + urllib.parse.urlencode({
        "action": "query", "prop": "imageinfo",
        "iiprop": "size|extmetadata|url",
        "titles": "|".join(batch), "format": "json",
    })
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "40", url], capture_output=True)
    d = json.loads(r.stdout.decode("utf8", "replace"))
    for page in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (page.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {}) or {}
        title = page.get("title", "?")
        w, h = ii.get("width", 0), ii.get("height", 0)
        lic = (em.get("LicenseShortName", {}) or {}).get("value", "?")
        artist = (em.get("Artist", {}) or {}).get("value", "?")
        import re
        artist = re.sub(r"<[^>]+>", "", artist)[:60]
        print(f"{title}\n  {w}x{h}  license={lic}  artist={artist}\n  {ii.get('url','')[:100]}")
    time.sleep(2)
