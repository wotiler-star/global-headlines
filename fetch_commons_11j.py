# -*- coding: utf-8 -*-
"""fetch_commons_11j.py — 从 commons_picks_11j.json 下载高分候选原图
Special:FilePath?width=2000 + 浏览器 UA；逐张间隔 13s；429/错误页冷却 120s；
魔法字节校验（JPEG/PNG/WEBP），失败不落盘。输出 downloads_11j.json 映射。
"""
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "brand_real_11j"
SRC.mkdir(exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
PICKS = json.loads((ROOT / "commons_picks_11j.json").read_text(encoding="utf8"))

# 人工按切题度挑出的候选索引（commons_picks_11j.json 各组按面积降序）。
# 已排除：山景/书籍封面/绘画/示意图、军事（Defense.gov、Spangdahlem、NRL）、
# 宗教场所（Blue Mosque）、航天器部件（Europa Clipper）、地区敏感机构。
PICKS_BY_INDEX = {
    "photonic-memristor": [7, 6, 12, 15, 11, 16],      # 铌酸锂晶圆/激光光学/激光器/实验室
    "lipid-chain-aging": [1, 5, 11, 6, 8, 17, 10],     # 备餐/果蝇/小鼠/质谱仪/蔬果餐/线虫
    "hotel-content-economy": [5, 15, 2, 11, 0, 22, 21],  # 客房/餐厅/大堂/老街/民宿庭院
}
MIN_W = 1200           # 原图宽度下限，避免裁到 1200x800 时放大变糊
GAP = 13

MAGIC = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG\r\n\x1a\n": ".png",
    b"RIFF": ".webp",
}


def check(head):
    for m, ext in MAGIC.items():
        if head.startswith(m):
            return ext
    return None


mapping = {}
for group, idxs in PICKS_BY_INDEX.items():
    items = PICKS[group]
    picked = [items[n] for n in idxs if (items[n].get("w") or 0) >= MIN_W]
    print("==", group, "下载", len(picked), "张", flush=True)
    for i, item in enumerate(picked, 1):
        title = item["title"]
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
                print("  ok  %-34s %6dKB  %s" % (out.name, len(data) // 1024, title[:62]), flush=True)
                break
            print("  retry %s (%s, %d bytes)" % (base, "非图片" if not ext else "过小",
                                                 len(data)), flush=True)
            tmp.unlink(missing_ok=True)
            time.sleep(120)
        else:
            print("  FAIL", base, flush=True)
        time.sleep(GAP)

(ROOT / "downloads_11j.json").write_text(
    json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf8")
print("[fetch_commons_11j] done,", len(mapping), "张", flush=True)
