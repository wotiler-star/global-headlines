# -*- coding: utf-8 -*-
"""fetch_11q_images.py — Commons 真实照片候选下载（Special:FilePath 通道 + UA + 魔法字节校验 + 逐张 flush 元数据）"""
import urllib.request, urllib.parse, urllib.error, json, time, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DST = ROOT / "brand_real_11q"
DST.mkdir(exist_ok=True)
META = ROOT / "downloads_11q.json"
UA = {"User-Agent": "starteday-editorial/1.0 (contact: admin@starteday.com)"}

GROUPS = {
    "twisted-oxide-moire": [
        "File:Stocrystal.jpg",
        "File:Stohrem.jpg",
        "File:SrTiO3 single crystal substrates.png",
        "File:Scanning electron microscope - UFCH JH (2020) 01.jpg",
        "File:FZU AV CR Silicon Single Crystal A.jpg",
        "File:Zinc oxide crystal (4071616901).jpg",
    ],
    "glucose-powered-neuroaxis": [
        "File:(20250417) Blood glucose meter 09.jpg",
        "File:(20250417) Blood glucose meter 06.jpg",
        "File:Blood glucose test strip2.jpg",
        "File:Accu-chek blood glucose test strips.jpg",
        "File:Vagus nerve stimulation.jpg",
        "File:A Blood-Glucose-Powered Metabolic Fuel Cell for Self-Sufficient Bioelectronics.webp",
    ],
    "folding-steering-suv": [
        "File:Caterham steering wheel at Goodwood 2012.jpg",
        "File:Racing steering wheel with hand controls.jpg",
        "File:Mercedes-AMG EQE 53 4MATIC+ SUV (X294) interior.jpg",
        "File:The interior of Mercedes-Benz EQS 450 4MATIC SUV (X296).jpg",
        "File:2022 Citroen C5 Aircross SUV blue interior view in Brunei.jpg",
        "File:Old car steering wheel (2662480818).jpg",
    ],
}
TITLES = [t for v in GROUPS.values() for t in v]


def api(params):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45) as r:
        return json.load(r)


def clean(v):
    return re.sub(r"<[^>]+>", "", str(v or "")).strip()


info = {}
for i in range(0, len(TITLES), 10):
    batch = TITLES[i:i + 10]
    try:
        d = api({"action": "query", "prop": "imageinfo", "iiprop": "size|extmetadata|url",
                 "titles": "|".join(batch), "format": "json"})
        for p in d.get("query", {}).get("pages", {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata") or {}
            info[p.get("title")] = {
                "width": ii.get("width"), "height": ii.get("height"),
                "descriptionurl": ii.get("descriptionurl"),
                "license": clean((em.get("LicenseShortName") or {}).get("value")) or clean((em.get("UsageTerms") or {}).get("value")),
                "licenseurl": clean((em.get("LicenseUrl") or {}).get("value")),
                "artist": clean((em.get("Artist") or {}).get("value"))[:400],
                "credit": clean((em.get("Credit") or {}).get("value"))[:300],
            }
    except Exception as e:
        print("META BATCH ERR", i, repr(e)[:120])
    time.sleep(2)

meta = {"info": info, "downloads": {}}


def flush():
    META.write_bytes((json.dumps(meta, ensure_ascii=False, indent=2) + "\n").encode("utf8"))


flush()


def magic(data):
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


idx = 0
for slug, titles in GROUPS.items():
    for n, title in enumerate(titles, 1):
        idx += 1
        key = f"{slug}__{n:02d}__{title}"
        enc = urllib.parse.quote(title, safe="")
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{enc}?width=1280"
        ok = False
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=55) as r:
                    data = r.read()
                kind = magic(data)
                if not kind:
                    raise ValueError("bad magic bytes: " + repr(data[:16]))
                fn = f"g{GROUPS.__len__() if False else 0}_{idx:02d}.{kind}"
                # 简单文件名：cand_01.jpg ...
                fn = f"cand_{idx:02d}.{kind}"
                (DST / fn).write_bytes(data)
                meta["downloads"][key] = {
                    "slug": slug, "title": title, "file": fn, "bytes": len(data),
                    "kind": kind, "source_url": url,
                    "meta": info.get(title, {}),
                }
                flush()
                print(f"OK  {idx:02d} {kind:4s} {len(data):8d}  {title[:70]}")
                ok = True
                break
            except urllib.error.HTTPError as e:
                print(f"HTTP {e.code} {idx:02d} {title[:50]} (attempt {attempt+1})")
                time.sleep(15)
            except Exception as e:
                print(f"ERR {idx:02d} {repr(e)[:90]} (attempt {attempt+1})")
                time.sleep(15)
        if not ok:
            print(f"SKIP {idx:02d} {title}")
            meta["downloads"][key] = {"slug": slug, "title": title, "file": None, "error": "failed"}
            flush()
        time.sleep(6)

print("DONE", len([v for v in meta["downloads"].values() if v.get("file")]), "/", len(TITLES))
