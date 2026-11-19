# -*- coding: utf-8 -*-
"""fetch_commons_11m.py — 从 picks_11m.json 下载 Commons 高分候选原图。

Special:FilePath?width=2000 + 浏览器 UA；逐张间隔 13s；429/错误页冷却 120s；
魔法字节校验（JPEG/PNG/WEBP），失败不落盘。输出 downloads_11m.json 元数据映射。
"""
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "brand_real_11m"
SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / "commons_picks_11m.json").read_text(encoding="utf8"))
WANT = json.loads((ROOT / "picks_11m.json").read_text(encoding="utf8"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
MIN_W = 1200
GAP = 13
MAGIC = {b"\xff\xd8\xff": ".jpg", b"\x89PNG\r\n\x1a\n": ".png", b"RIFF": ".webp"}


def check(head):
    for m, ext in MAGIC.items():
        if head.startswith(m):
            return ext
    return None


def find(group, title):
    for item in PICKS.get(group, []):
        if item["title"] == title:
            return item
    return None


mapping = {}
for group, titles in WANT.items():
    print("==", group, "待下载", len(titles), "张", flush=True)
    for i, title in enumerate(titles, 1):
        item = find(group, title)
        if not item:
            print("  !! 候选池里没有", title, flush=True)
            continue
        if (item.get("w") or 0) < MIN_W:
            print("  !! 分辨率不足，跳过", title, item.get("w"), flush=True)
            continue
        quoted = urllib.parse.quote(title.replace(" ", "_"), safe="")
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/%s?width=2000" % quoted
        base = "%s-%02d" % (group, i)
        for attempt in range(4):
            tmp = SRC / (base + ".tmp")
            r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "100",
                                "-o", str(tmp), url], capture_output=True)
            data = tmp.read_bytes() if tmp.exists() else b""
            ext = check(data[:16])
            if ext and len(data) > 20000:
                out = SRC / (base + ext)
                out.write_bytes(data)
                tmp.unlink(missing_ok=True)
                mapping[out.name] = {k: item[k] for k in
                                     ("title", "w", "h", "license", "artist", "page", "url")}
                mapping[out.name]["commons_page"] = item["page"]
                print("  ok  %-30s %6dKB  %s" % (out.name, len(data) // 1024, title[:62]), flush=True)
                break
            print("  retry %s (%s, %d bytes)" % (
                base, "非图片" if not ext else "过小", len(data)), flush=True)
            tmp.unlink(missing_ok=True)
            time.sleep(120)
        else:
            print("  FAIL", base, flush=True)
        time.sleep(GAP)

(ROOT / "downloads_11m.json").write_text(
    json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf8")
print("[fetch_commons_11m] done,", len(mapping), "张", flush=True)
