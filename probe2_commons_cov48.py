# -*- coding: utf-8 -*-
"""probe2_commons_cov48.py — 二轮换词：专找高分辨率的汽车座舱 / 电路板照片"""
import json
import subprocess
import time
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"
QS = [
    "modern car dashboard",
    "car instrument cluster",
    "Tesla interior",
    "car steering wheel dashboard",
    "computer motherboard",
    "circuit board macro",
    "integrated circuit chip",
]


def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "40", url], capture_output=True)
    try:
        return json.loads(r.stdout.decode("utf8", "replace"))
    except Exception:
        return None


for q in QS:
    d = api({
        "action": "query", "list": "search",
        "srsearch": "filetype:bitmap " + q,
        "srnamespace": 6, "srlimit": 8, "format": "json",
    })
    titles = [x["title"] for x in (d or {}).get("query", {}).get("search", [])]
    print(f"[{q}] {len(titles)}", flush=True)
    for t in titles:
        print("   " + t, flush=True)
    time.sleep(2)
