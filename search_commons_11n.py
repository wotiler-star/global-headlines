# -*- coding: utf-8 -*-
"""search_commons_11n.py — 2026-11n 三组主题的 Wikimedia Commons 真实照片候选池。

带浏览器 UA、逐请求间隔、429 短退避；排除 AI 生成图 / 矢量插画 / 示意图 /
电镜微距 / 低信息量标题与政治军事宗教种族儿童合规雷区。
输出 commons_picks_11n.json 供九宫格目检。
"""
import json
import re
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
API = "https://commons.wikimedia.org/w/api.php"

GROUPS = {
    "locust-cannibalism-scent": [
        "desert locust Schistocerca gregaria", "migratory locust Locusta migratoria",
        "grasshopper insect on plant", "locust nymph on leaf",
        "entomology insect laboratory", "wheat field cereal crop",
        "gas chromatography laboratory instrument", "petri dish bacterial colonies",
    ],
    "fluorinated-electrolyte-battery": [
        "lithium ion battery cells", "electric car charging station",
        "electric vehicle charging cable", "lithium battery pack module",
        "laboratory glassware chemistry flask", "electrolyte beaker laboratory",
        "electric car showroom", "18650 battery cell closeup",
    ],
    "smart-floss-metabolism": [
        "dental floss teeth", "dentist dental clinic treatment",
        "teeth oral hygiene mirror", "blood glucose meter test",
        "microfluidic lab chip", "laboratory pipette sample tube",
        "toothbrush dental care", "smartphone health application screen",
    ],
}

BAD_TITLE = re.compile(
    r"(DALL|stable diffusion|midjourney|AI[- ]generat|artificial intelligence generated|"
    r"diagram|schematic|illustration|drawing|graphic|logo|icon|render|sketch|"
    r"chart|graph|poster|banner|signage|map of|coat of arms|flags? of|"
    r" Putin| Navy|Marine Corps|military|army|missile|weapon|war|soldier|"
    r"church|monk|religio|child|kindergarten|Taiwanese|protest|election|"
    r"X-ray|micrograph|SEM|electron microscop|screenshot|close-up of screen|"
    r"bible|plague of locusts|biblical)", re.I)


def api(params, tries=4):
    url = API + "?" + urllib.parse.urlencode(params)
    for k in range(tries):
        r = subprocess.run(["curl", "-sS", "-A", UA, "--max-time", "40", url],
                           capture_output=True)
        out = r.stdout.decode("utf8", "replace")
        if "too many requests" in out.lower() or "rate limit" in out.lower():
            print("  429 -> 冷却 90s", flush=True)
            time.sleep(90)
            continue
        try:
            return json.loads(out)
        except Exception:
            print("  非 JSON 响应，重试:", out[:120], flush=True)
            time.sleep(15)
    return {}


def main():
    titles = {}
    for group, kws in GROUPS.items():
        seen = set()
        for kw in kws:
            d = api({"action": "query", "list": "search",
                     "srsearch": "filetype:bitmap " + kw,
                     "srnamespace": 6, "srlimit": 10,
                     "format": "json", "formatversion": 2})
            hits = (d.get("query") or {}).get("search") or []
            for h in hits:
                t = h.get("title", "")
                if not t.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")):
                    continue
                if BAD_TITLE.search(t):
                    continue
                if t not in seen:
                    seen.add(t)
                    titles.setdefault(group, []).append(t)
            print("[search]", group, "|", kw, "->", len(hits), "命中 / 累计", len(seen), flush=True)
            time.sleep(7)
    all_t = [t for v in titles.values() for t in v]
    print("候选标题合计", len(all_t), flush=True)

    info = {}
    for i in range(0, len(all_t), 40):
        batch = all_t[i:i + 40]
        d = api({"action": "query", "prop": "imageinfo",
                 "iiprop": "size|extmetadata|url",
                 "titles": "|".join(batch), "format": "json", "formatversion": 2})
        for p in (d.get("query") or {}).get("pages") or []:
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata") or {}
            info[p.get("title")] = {
                "w": ii.get("width"), "h": ii.get("height"),
                "license": (em.get("LicenseShortName") or {}).get("value", ""),
                "artist": (em.get("Artist") or {}).get("value", ""),
                "page": ii.get("descriptionurl", ""),
                "url": ii.get("url", ""),
                "mime": ii.get("mime", ""),
            }
        print("[info] batch", i, "->", len(info), flush=True)
        time.sleep(7)

    out = {}
    for group, ts in titles.items():
        out[group] = []
        for t in ts:
            m = info.get(t, {})
            if not m.get("w") or not m.get("url"):
                continue
            out[group].append({"title": t, **m})
        out[group].sort(key=lambda x: -(x["w"] * x["h"]))
    (ROOT / "commons_picks_11n.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8")
    for g, v in out.items():
        print("\n==", g, len(v), "张==", flush=True)
        for n, x in enumerate(v[:22]):
            print("  %2d %5dx%-5d %-18s %s" % (
                n, x["w"], x["h"], x["license"][:18], x["title"][:80]), flush=True)
    print("\n[search_commons_11n] done", flush=True)


if __name__ == "__main__":
    main()
