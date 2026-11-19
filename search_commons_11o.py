# -*- coding: utf-8 -*-
"""search_commons_11o.py — 为 2026-11o 的 5 个主题搜索 Commons 真实照片候选。
主题：chip-voyage / container-cargo / crossborder-decade / smart-port / oem-to-brand
每主题多组关键词，抓候选并查 imageinfo（分辨率/许可/作者/文件页）。
过滤：AI 生成图、矢量插画、尺寸过小、明显敏感词标题。
"""
import json, time, urllib.parse, urllib.request, re
from pathlib import Path

ROOT = Path('.')
UA = "starteday-editorial/1.0 (contact: admin@starteday.com)"

# 每主题多组关键词（英文具体名词）
QUERIES = {
    "chip-voyage": ["semiconductor wafer", "microchip macro", "computer circuit board", "silicon wafer fab"],
    "container-cargo": ["container terminal", "shipping containers stack", "cherries fruit market", "lobster seafood"],
    "crossborder-decade": ["warehouse automation", "online shopping parcel", "delivery drone package", "ecommerce logistics"],
    "smart-port": ["container terminal crane", "automated port", "cargo ship harbor", "gantry crane container"],
    "oem-to-brand": ["rice cooker", "perfume bottle glass", "shoe factory production", "textile factory machine"],
}

# 明显该排除的标题特征：AI 生成、插画、地图、标志
BAD_TITLE = re.compile(r"dall|stable diffusion|midjourney|generative|ai[- ]generated|logo|icon|map of|diagram|illustration|svg|coat of arms|flag of", re.I)
# 敏感标题（政治/军事/儿童/宗教）
SENS_TITLE = re.compile(r"politic|president|parliament|government|election|military|army|navy|missile|weapon|war\b|soldier|child|kid\b|baby|church|mosque|monk|religio", re.I)


def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf8"))
        except Exception as e:
            print("  api retry", attempt, str(e)[:60], flush=True)
            time.sleep(4)
    return None


def clean_artist(html):
    s = re.sub(r"<[^>]+>", "", html or "")
    s = re.sub(r"\s+", " ", s).strip()
    m = re.search(r"user\s+([A-Za-z0-9._\-]+)", s, re.I)
    if m:
        return "Wikimedia Commons user " + m.group(1)
    return s[:70]


out = {}
for group, kws in QUERIES.items():
    pool = []
    seen = set()
    for kw in kws:
        params = {
            "action": "query", "list": "search", "srsearch": "filetype:bitmap " + kw,
            "srnamespace": "6", "srlimit": "12", "format": "json",
        }
        j = api(params)
        if not j:
            continue
        titles = [x["title"] for x in j.get("query", {}).get("search", [])]
        print(f"[{group}] '{kw}' -> {len(titles)} 候选", flush=True)
        for t in titles:
            if t in seen:
                continue
            seen.add(t)
            if BAD_TITLE.search(t) or SENS_TITLE.search(t):
                continue
            pool.append(t)
        time.sleep(2)
    # 查元数据（分批，每批 10 个标题）
    items = []
    for i in range(0, len(pool), 10):
        batch = pool[i:i+10]
        params = {
            "action": "query", "titles": "|".join(batch), "prop": "imageinfo",
            "iiprop": "size|extmetadata|url", "format": "json",
        }
        j = api(params)
        if not j:
            continue
        for page in j.get("query", {}).get("pages", {}).values():
            ii = page.get("imageinfo", [{}])[0]
            if not ii:
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 1200 or h < 800:  # 短边不足以裁 1200x800
                continue
            ext = ii.get("extmetadata", {})
            lic = ext.get("LicenseShortName", {}).get("value", "")
            artist = clean_artist(ext.get("Artist", {}).get("value", ""))
            title = page.get("title", "")
            rec = {
                "title": title, "w": w, "h": h, "license": lic,
                "artist": artist, "page": ii.get("descriptionurl", ""),
                "url": ii.get("url", ""),
            }
            items.append(rec)
        time.sleep(2)
    out[group] = items
    print(f"[{group}] 合格候选 {len(items)} 张", flush=True)

(ROOT / "commons_picks_11o.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8")
print("DONE -> commons_picks_11o.json", flush=True)
