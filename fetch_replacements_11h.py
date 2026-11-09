# -*- coding: utf-8 -*-
"""fetch_replacements_11h.py — 下载替换 oled-ipad-mini 封面的合规候选（纯产品/桌面照）
已排除：政治、军事、宗教、儿童、地区敏感表述的候选。
"""
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "brand_real_11h"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

EXTRA = {
    "oled-repl-a.jpg": "File:About iPad Air 13-inch (M2).jpg",
    "oled-repl-b.jpg": "File:Microsoft Surface Pro 3 - 1.jpg",
    "oled-repl-c.jpg": "File:Person interacts with tablet at a tech event.jpg",
    "oled-repl-d.jpg": "File:Sony Tablet S.jpg",
    "oled-repl-e.jpg": "File:Gadgets on a desk (Unsplash).jpg",
}


def magic_ok(p):
    b = p.read_bytes()[:12]
    return b.startswith(b"\xff\xd8\xff") or b.startswith(b"\x89PNG") or (b[:4] == b"RIFF" and b[8:12] == b"WEBP")


def main():
    cand = json.loads((ROOT / "replacement_candidates_11h.json").read_text(encoding="utf8"))
    info = cand["info"]
    picks = json.loads((ROOT / "commons_picks_11h.json").read_text(encoding="utf8"))
    n = len(EXTRA)
    for i, (local, title) in enumerate(EXTRA.items(), 1):
        meta = info.get(title, {})
        dest = OUT / local
        name = title.replace("File:", "", 1).replace(" ", "_")
        url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
               + urllib.parse.quote(name, safe="") + "?width=2000")
        print("[%d/%d] %s" % (i, n, local), flush=True)
        ok = False
        for attempt in range(4):
            r = subprocess.run(["curl", "-sSL", "--max-time", "120", "-A", UA,
                                "-w", "%{http_code}", "-o", str(dest), url],
                               capture_output=True, text=True, timeout=140)
            code = (r.stdout or "").strip()[-3:]
            if code == "200" and dest.exists() and magic_ok(dest) and dest.stat().st_size > 20000:
                ok = True
                break
            if code == "429":
                print("    429 -> 冷却 120s", flush=True)
                time.sleep(120)
            else:
                print("    尝试 %d: code=%s" % (attempt + 1, code), flush=True)
                time.sleep(15)
        if ok:
            picks[local] = {"title": title, "commons_page": meta.get("page"),
                            "artist": meta.get("artist"), "license": meta.get("license"),
                            "w": meta.get("w"), "h": meta.get("h")}
            print("    OK %d KB %s" % (dest.stat().st_size // 1024, meta.get("license")), flush=True)
        else:
            print("    FAIL", flush=True)
        if i < n:
            time.sleep(13)
    (ROOT / "commons_picks_11h.json").write_text(
        json.dumps(picks, ensure_ascii=False, indent=2), encoding="utf8")
    print("DONE picks=%d" % len(picks), flush=True)


if __name__ == "__main__":
    main()
