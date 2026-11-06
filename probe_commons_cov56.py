# -*- coding: utf-8 -*-
"""probe_commons_cov56.py — 本批 3 主题候选照片检索（filetype:bitmap，带 UA）"""
import json
import subprocess
import sys
import time
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"


def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "40", url], capture_output=True)
    try:
        return json.loads(r.stdout.decode("utf8", "replace"))
    except Exception:
        return None


QUERIES = {
    "desktop": ["desktop computer workstation", "computer desk monitor keyboard", "office computer setup"],
    "refinery": ["oil refinery", "petroleum refinery plant", "oil refinery at night"],
    "brain": ["electroencephalography", "EEG cap", "brain MRI scan"],
}

topic_filter = sys.argv[1] if len(sys.argv) > 1 else None
for topic, qs in QUERIES.items():
    if topic_filter and topic != topic_filter:
        continue
    for q in qs:
        d = api({
            "action": "query", "list": "search",
            "srsearch": "filetype:bitmap " + q,
            "srnamespace": 6, "srlimit": 8, "format": "json",
        })
        titles = [x["title"] for x in (d or {}).get("query", {}).get("search", [])]
        print(f"[{topic}] {q}: {len(titles)}", flush=True)
        for t in titles:
            print("   " + t, flush=True)
        time.sleep(2)
