# -*- coding: utf-8 -*-
"""search_replacements_11h.py — 为存量劣质封面搜真实、主体明确的 Commons 替代图"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

GROUPS = {
    "oled-ipad-mini": ["iPad tablet computer device", "tablet computer front view",
                       "iPad Air tablet", "tablet device on table"],
    "rna-model": ["DNA sequencing laboratory", "genome sequencer machine",
                  "DNA laboratory research", "molecular biology laboratory"],
    "france-colonial": ["rubber tree plantation latex", "Hevea brasiliensis tapping",
                        "rubber plantation tree", "Hanoi French colonial building"],
    "phage": ["bacteriophage electron micrograph", "petri dish bacterial plaques",
              "phage plaques agar plate", "bacteria culture plate laboratory"],
}
BAD = re.compile(
    r"DALL|stable.?diffusion|midjourney|AI.?generat|illustration|diagram|logo|icon|"
    r"\.svg|drawing|sketch|render|artist.?impression|simulation|chart|graph|"
    r"text|poster|banner|collage|animation|animated|map|painting|engraving", re.I)


def api(params, tries=5):
    params = dict(params); params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("  retry", attempt + 1, e, flush=True)
            time.sleep(10 * (attempt + 1))
    return {}


def clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(s or ""))).strip()


def main():
    out = {}
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
            print("[%s] %-36s -> %d" % (slug, kw, len(seen)), flush=True)
            time.sleep(3)
        out[slug] = seen

    titles = sorted({t for v in out.values() for t in v})
    info = {}
    for i in range(0, len(titles), 8):
        chunk = titles[i:i + 8]
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
            }
        print("info %d/%d" % (min(i + 8, len(titles)), len(titles)), flush=True)
        time.sleep(3)

    (ROOT / "replacement_candidates_11h.json").write_text(
        json.dumps({"candidates": out, "info": info}, ensure_ascii=False, indent=2),
        encoding="utf8")
    print("DONE titles=%d" % len(titles), flush=True)


if __name__ == "__main__":
    main()
