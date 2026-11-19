# -*- coding: utf-8 -*-
"""search_commons_11l_b.py — 二轮换词：ai-shopping-agent 组候选补充。

第一轮 parcel sorting warehouse 等词跑偏（空货架、挪威学校、机构名），
改用更具体的物流/配送/购物名词，结果合并进 commons_picks_11l.json。
"""
import json
import re
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "commons_picks_11l.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"
GROUP = "ai-shopping-agent"
KWS = [
    "warehouse logistics interior", "distribution center shelves",
    "parcel delivery van", "packages conveyor belt sorting",
    "shopping cart supermarket aisle", "smartphone shopping payment",
    "postal parcels sorting",
]
BAD_TITLE = re.compile(
    r"(DALL|stable diffusion|midjourney|AI[- ]generat|artificial intelligence generated|"
    r"diagram|schematic|illustration|drawing|graphic|logo|icon|render|sketch|"
    r"chart|graph|poster|banner|signage|map of|coat of arms|flags? of|"
    r" Putin| Navy|Marine Corps|military|army|missile|weapon|war|soldier|"
    r"church|monk|religio|child|kindergarten|Taiwanese|protest|election|"
    r"empty shelves|X-ray|micrograph|screenshot|NAVFAC|suspicious)", re.I)


def api(params, tries=4):
    url = API + "?" + urllib.parse.urlencode(params)
    for k in range(tries):
        r = subprocess.run(["curl", "-sS", "-A", UA, "--max-time", "40", url],
                           capture_output=True)
        out = r.stdout.decode("utf8", "replace")
        if "too many requests" in out.lower() or "rate limit" in out.lower():
            print("  429 -> 冷却 120s", flush=True)
            time.sleep(120)
            continue
        try:
            return json.loads(out)
        except Exception:
            print("  非 JSON，重试", flush=True)
            time.sleep(20)
    return {}


def main():
    data = json.loads(OUT.read_text(encoding="utf8"))
    have = {x["title"] for x in data.get(GROUP, [])}
    titles = []
    for kw in KWS:
        d = api({"action": "query", "list": "search",
                 "srsearch": "filetype:bitmap " + kw,
                 "srnamespace": 6, "srlimit": 10,
                 "format": "json", "formatversion": 2})
        hits = (d.get("query") or {}).get("search") or []
        for h in hits:
            t = h.get("title", "")
            if not t.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            if BAD_TITLE.search(t) or t in have:
                continue
            have.add(t)
            titles.append(t)
        print("[search b]", kw, "->", len(hits), "命中 / 累计新增", len(titles), flush=True)
        time.sleep(10)

    info = {}
    for i in range(0, len(titles), 40):
        d = api({"action": "query", "prop": "imageinfo",
                 "iiprop": "size|extmetadata|url",
                 "titles": "|".join(titles[i:i + 40]), "format": "json", "formatversion": 2})
        for p in (d.get("query") or {}).get("pages") or []:
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata") or {}
            info[p.get("title")] = {
                "w": ii.get("width"), "h": ii.get("height"),
                "license": (em.get("LicenseShortName") or {}).get("value", ""),
                "artist": (em.get("Artist") or {}).get("value", ""),
                "page": ii.get("descriptionurl", ""),
                "url": ii.get("url", ""), "mime": ii.get("mime", ""),
            }
        time.sleep(10)

    added = [{"title": t, **info[t]} for t in titles if info.get(t, {}).get("w")]
    data[GROUP] = (data.get(GROUP, []) + added)
    data[GROUP].sort(key=lambda x: -(x["w"] * x["h"]))
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf8")
    print("\n[search b] 新增", len(added), "张，该组合计", len(data[GROUP]))
    for n, x in enumerate(data[GROUP][:26]):
        print("  %2d %5dx%-5d %-18s %s" % (n, x["w"], x["h"], x["license"][:18], x["title"][:80]))


if __name__ == "__main__":
    main()
