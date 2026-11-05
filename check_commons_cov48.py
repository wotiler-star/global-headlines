# -*- coding: utf-8 -*-
"""check_commons_cov48.py — 查询候选 Commons 图片的分辨率 / 许可 / 作者"""
import json
import re
import subprocess
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

# 目标文件名 -> Commons 文件标题（避开政治会议、军事装备、矢量插画）
PICKS = {
    "spatial-glasses-cover.webp": "WAIC 2025 - Alibaba Quark Glasses 01.jpg",
    "spatial-glasses-fig1.webp": "Vuzix Blade.jpg",
    "spatial-glasses-fig2.webp": "Augmented Reality Headset 02.jpg",
    "edge-ai-chip-cover.webp": "Macro circuit board.JPG",
    "edge-ai-chip-fig1.webp": "Printed Circuit Board 9990.jpg",
    "edge-ai-chip-fig2.webp": "Pro Micro MCU board.jpg",
    "car-ai-cover.webp": "Tesla Model 3 interior.jpg",
    "car-ai-fig1.webp": "Smartphone mounted on car dashboard during a drive in a modern vehicle with a focus on navigation use.jpg",
    "car-ai-fig2.webp": "Close-up of engine oil temperature gauge on car dashboard (49006320293).jpg",
}


def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "45", url], capture_output=True)
    try:
        return json.loads(r.stdout.decode("utf8", "replace"))
    except Exception:
        return None


def clean(s):
    return re.sub(r"<[^>]+>", "", str(s or "")).strip().replace("\n", " ")[:110]


if __name__ == "__main__":
    titles = ["File:" + t for t in PICKS.values()]
    d = api({
        "action": "query", "prop": "imageinfo",
        "iiprop": "size|extmetadata|url",
        "titles": "|".join(titles), "format": "json",
    })
    pages = (d or {}).get("query", {}).get("pages", {})
    info = {}
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {}) or {}
        info[p.get("title", "").replace("File:", "")] = {
            "w": ii.get("width"), "h": ii.get("height"),
            "license": clean(em.get("LicenseShortName", {}).get("value")),
            "artist": clean(em.get("Artist", {}).get("value")),
            "usage": clean(em.get("UsageTerms", {}).get("value")),
            "credit": clean(em.get("Credit", {}).get("value")),
            "url": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(
                p.get("title", "").replace(" ", "_")),
        }
    for name, title in PICKS.items():
        v = info.get(title, {})
        print(f"{name:34} {title[:52]:52} {v.get('w')}x{v.get('h')} | {v.get('license')} | {v.get('artist')[:46]}")
    with open("commons_picks_cov48.json", "w", encoding="utf8") as f:
        json.dump({"picks": PICKS, "info": info}, f, ensure_ascii=False, indent=2)
    print("\n已写 commons_picks_cov48.json")
