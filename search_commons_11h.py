# -*- coding: utf-8 -*-
"""search_commons_11h.py — 2026-11h 批次 Commons 候选检索（搜索 + imageinfo）
带浏览器 UA、请求间隔、429 退避；排除 AI 生成图/矢量插画/示意图。
输出 commons_candidates_11h.json 供人工挑选。
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"
ROOT = Path(__file__).resolve().parent

GROUPS = {
    "solar-flare-field": [
        "solar flare Sun", "Sun H-alpha", "sunspots Sun surface",
        "solar telescope observatory", "solar observatory dome", "Sun chromosphere",
    ],
    "gut-nad-precursor": [
        "intestinal villi histology", "cell culture laboratory", "laboratory microscope",
        "petri dish bacterial colonies", "colon histology", "lactobacillus microscopy",
    ],
    "long-livephoto": [
        "smartphone camera", "smartphone camera module", "taking photo with smartphone",
        "telephoto camera lens", "smartphone close up", "mobile phone photography",
    ],
}
BAD = re.compile(
    r"DALL|stable.?diffusion|midjourney|AI.?generat|illustration|diagram|logo|icon|"
    r"\.svg|drawing|sketch|render|artist.?impression|simulation|chart|graph|"
    r"text|poster|banner|collage|animation|animated", re.I)


def api(params, tries=5):
    params = dict(params)
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("  retry %d: %s" % (attempt + 1, e), flush=True)
            time.sleep(10 * (attempt + 1))
    return {}


def clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(s or ""))).strip()


def main():
    candidates = {}
    for slug, kws in GROUPS.items():
        seen = []
        for kw in kws:
            d = api({"action": "query", "list": "search",
                     "srsearch": "filetype:bitmap " + kw,
                     "srnamespace": 6, "srlimit": 8})
            for it in d.get("query", {}).get("search", []):
                t = it["title"]
                if BAD.search(t) or t in seen:
                    continue
                seen.append(t)
            print("[%s] %-38s -> %d" % (slug, kw, len(seen)), flush=True)
            time.sleep(3)
        candidates[slug] = seen

    all_titles = sorted({t for v in candidates.values() for t in v})
    info = {}
    for i in range(0, len(all_titles), 8):
        chunk = all_titles[i:i + 8]
        d = api({"action": "query", "titles": "|".join(chunk),
                 "prop": "imageinfo", "iiprop": "size|extmetadata|url"})
        for p in d.get("query", {}).get("pages", {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {})
            info[p["title"]] = {
                "w": ii.get("width"), "h": ii.get("height"),
                "license": clean(em.get("LicenseShortName", {}).get("value", "")),
                "artist": clean(em.get("Artist", {}).get("value", ""))[:160],
                "page": ii.get("descriptionurl"),
                "url": ii.get("url"),
            }
        print("info %d/%d" % (min(i + 8, len(all_titles)), len(all_titles)), flush=True)
        time.sleep(3)

    out = {"candidates": candidates, "info": info}
    (ROOT / "commons_candidates_11h.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8")
    print("DONE candidates=%d info=%d" % (len(all_titles), len(info)), flush=True)


if __name__ == "__main__":
    main()
