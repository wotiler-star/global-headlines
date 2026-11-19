# -*- coding: utf-8 -*-
"""fetch_11n.py — Commons 候选原图续跑下载（429 冷却版）。

- 初始冷却 150s（Commons 对 IP 的整体限流恢复窗口）。
- 已落盘文件跳过，但**补写元数据**到 downloads_11n.json（防止中途 kill 丢失元数据）。
- Special:FilePath + UA + 逐张间隔 12s；遇 429 冷却 120s，最多 4 次。
- 魔法字节校验 + >20KB 过滤。
"""
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "brand_real_11n"
SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / "commons_picks_11n.json").read_text(encoding="utf8"))
META = json.loads((ROOT / "downloads_11n.json").read_text(encoding="utf8")) if (ROOT / "downloads_11n.json").exists() else {}
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
MAGIC = {b'\xff\xd8\xff': '.jpg', b'\x89PNG\r\n\x1a\n': '.png', b'RIFF': '.webp'}

WANT = {
    "locust-cannibalism-scent": [0, 2, 3, 11, 14, 17, 21, 27],
    "fluorinated-electrolyte-battery": [5, 6, 7, 14, 24, 26, 35, 2],
    "smart-floss-metabolism": [17, 14, 18, 22, 13, 10, 35, 39],
}


def ext_of(d):
    for m, e in MAGIC.items():
        if d.startswith(m):
            return e
    return None


def meta_rec(item):
    rec = {k: item[k] for k in ("title", "w", "h", "license", "artist", "page", "url") if k in item}
    rec["commons_page"] = item.get("page", "")
    return rec


mapping = dict(META)
print("初始冷却 150s（Commons 429 恢复窗口）...", flush=True)
time.sleep(150)

for group, idxs in WANT.items():
    pool = PICKS[group]
    for n, idx in enumerate(idxs, 1):
        item = pool[idx]
        base = "%s-%02d" % (group, n)
        existing = [p for p in SRC.glob(base + ".*") if not p.name.endswith(".tmp")]
        if existing:
            mapping[existing[0].name] = meta_rec(item)
            print("skip exists", base, flush=True)
            continue
        title = item["title"]
        url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
               + urllib.parse.quote(title.replace(" ", "_"), safe="") + "?width=2000")
        ok = False
        for attempt in range(4):
            tmp = SRC / (base + ".tmp")
            r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "55",
                                "-o", str(tmp), "-w", "%{http_code}", url],
                               capture_output=True)
            code = r.stdout.decode(errors="replace").strip()
            data = tmp.read_bytes() if tmp.exists() else b""
            e = ext_of(data[:16])
            if e and len(data) > 20000:
                out = SRC / (base + e)
                out.write_bytes(data)
                tmp.unlink(missing_ok=True)
                mapping[out.name] = meta_rec(item)
                print("ok", base, len(data) // 1024, "KB", "|", title[:56], flush=True)
                ok = True
                break
            tmp.unlink(missing_ok=True)
            print("retry", base, "code", code, "bytes", len(data), flush=True)
            time.sleep(120)
        if not ok:
            print("FAIL", base, flush=True)
        time.sleep(12)
(ROOT / "downloads_11n.json").write_text(
    json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf8")
print("DONE files", len([p for p in SRC.glob('*.*') if not p.name.endswith('.tmp')]),
      "meta", len(mapping), flush=True)
