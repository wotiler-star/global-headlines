# -*- coding: utf-8 -*-
"""probe_commons_cov61.py — 第 4 批 3 主题候选真实照片检索"""
import json
import subprocess
import time
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

QUERIES = {
    "cold": ["laser laboratory optical table", "vacuum chamber physics laboratory", "cryostat laboratory"],
    "ecg": ["electrocardiogram ECG", "Holter monitor", "ECG electrodes chest"],
    "tire": ["car tire tread", "tire close up", "tire pressure gauge"],
}

for topic, qs in QUERIES.items():
    for q in qs:
        url = API + "?" + urllib.parse.urlencode({
            "action": "query", "list": "search", "srsearch": "filetype:bitmap " + q,
            "srnamespace": 6, "srlimit": 8, "format": "json"})
        r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "40", url], capture_output=True)
        try:
            d = json.loads(r.stdout.decode("utf8", "replace"))
        except Exception:
            d = {}
        titles = [x["title"] for x in d.get("query", {}).get("search", [])]
        print(f"[{topic}] {q}: {len(titles)}", flush=True)
        for t in titles:
            print("   " + t, flush=True)
        time.sleep(3)
