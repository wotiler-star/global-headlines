# -*- coding: utf-8 -*-
"""search_commons_11j.py — 2026-11j 三组主题 Commons 真实照片候选池
带浏览器 UA、逐请求间隔、429 退避；过滤 AI 生成图/矢量/示意图/敏感标题。
输出 commons_picks_11j.json 供人工九宫格目检。
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
    "photonic-memristor": [
        "photonic integrated circuit", "silicon photonics chip",
        "lithium niobate crystal", "optics laboratory laser", "silicon wafer macro",
    ],
    "lipid-chain-aging": [
        "Drosophila melanogaster", "laboratory mouse", "healthy meal vegetables",
        "mass spectrometer laboratory", "Caenorhabditis elegans",
    ],
    "hotel-content-economy": [
        "hotel room interior", "hotel lobby", "guesthouse courtyard",
        "smartphone photographing travel", "old town street market",
    ],
}

# 合规雷区 + AI 生成图 + 设计感/示意图（skill 图片质量门禁）
BAD_TITLE = re.compile(
    r"(DALL|stable diffusion|midjourney|AI[- ]generat|artificial intelligence generated|"
    r"diagram|schematic|illustration|drawing|graphic|logo|icon|render|sketch|"
    r" Putin| Navy|Marine Corps|military|army|missile|weapon|war|soldier|"
    r"church|monk|religio|child|kindergarten|Taiwanese|protest|election|"
    r"flags? of|coat of arms|map of|chart|graph|poster|banner|signage)", re.I)


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
            print("  非 JSON 响应，重试:", out[:120], flush=True)
            time.sleep(20)
    return {}


def main():
    titles = {}  # group -> [title]
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
            print("[search]", group, kw, "->", len(hits), "命中 / 累计", len(seen), flush=True)
            time.sleep(9)
    all_t = [t for v in titles.values() for t in v]
    print("候选标题合计", len(all_t), flush=True)

    # 批量查 imageinfo（一次最多 40 个 titles）
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
        time.sleep(9)

    out = {}
    for group, ts in titles.items():
        out[group] = []
        for t in ts:
            m = info.get(t, {})
            if not m.get("w") or not m.get("url"):
                continue
            # 短边 < 1200 的先标为备选，优先高清
            out[group].append({"title": t, **m})
        out[group].sort(key=lambda x: -(x["w"] * x["h"]))
    (ROOT / "commons_picks_11j.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8")
    for g, v in out.items():
        print("\n==", g, len(v), "张==")
        for x in v[:14]:
            print("  %5dx%-5d %-22s %s" % (x["w"], x["h"], x["license"][:22], x["title"][:80]))
    print("\n[search_commons_11j] done")


if __name__ == "__main__":
    main()
