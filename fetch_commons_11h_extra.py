# -*- coding: utf-8 -*-
"""fetch_commons_11h_extra.py — 补下载 3 张「人用手机拍照」真实场景照，
用于替换目检弃用的 long-livephoto-cover（示意图）与偏弱的 fig2（沙滩凉鞋）。
元数据合并回 commons_picks_11h.json。
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
    "long-livephoto-alt3.jpg": "File:Close-up of a woman using her smartphone while having coffee.jpg",
    "long-livephoto-alt4.jpg": "File:Woman holding mobile phone with laptop and colorful pencils on table.jpg",
    "long-livephoto-alt5.jpg": "File:SZ 深圳 Shenzhen 龍華 Longhua 深圳美術館 Shenzhen Art Museum lady taking photo with smartphone May 2024 R12S 02.jpg",
}


def magic_ok(p):
    b = p.read_bytes()[:12]
    return b.startswith(b"\xff\xd8\xff") or b.startswith(b"\x89PNG")


def main():
    picks = json.loads((ROOT / "commons_picks_11h.json").read_text(encoding="utf8"))
    cand = json.loads((ROOT / "commons_candidates_11h.json").read_text(encoding="utf8"))
    info = cand["info"]
    for i, (local, title) in enumerate(EXTRA.items(), 1):
        meta = info.get(title, {})
        dest = OUT / local
        name = title.replace("File:", "", 1).replace(" ", "_")
        url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
               + urllib.parse.quote(name, safe="") + "?width=2000")
        print("[%d/3] %s" % (i, local), flush=True)
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
            picks[local] = {
                "title": title, "commons_page": meta.get("page"),
                "artist": meta.get("artist"), "license": meta.get("license"),
                "w": meta.get("w"), "h": meta.get("h"),
            }
            print("    OK %d KB  %s" % (dest.stat().st_size // 1024, meta.get("license")), flush=True)
        else:
            print("    FAIL，跳过", flush=True)
        if i < len(EXTRA):
            time.sleep(13)
    (ROOT / "commons_picks_11h.json").write_text(
        json.dumps(picks, ensure_ascii=False, indent=2), encoding="utf8")
    print("DONE picks=%d" % len(picks), flush=True)


if __name__ == "__main__":
    main()
