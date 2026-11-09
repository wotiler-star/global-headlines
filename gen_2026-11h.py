# -*- coding: utf-8 -*-
"""gen_2026-11h.py — 装配 2026-11h 批次 8 语种 × 3 篇 = 24 条原创稿
内容来自 content_11h_{a,b,c,d}.py；bytes 写出保持 LF；publishedAt=0 由 prepare_cov48.py 注入。
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
D = ROOT / "data" / "original"
D.mkdir(parents=True, exist_ok=True)
SUFFIX = "2026-11h"

TOPICS = [
    {"slug": "solar-flare-field", "category": "science",
     "sourceUrl": "https://paper.sciencenet.cn/htmlpaper/2026/11/2026118134052958157753.shtm"},
    {"slug": "gut-nad-precursor", "category": "health",
     "sourceUrl": "https://www.ebiotrade.com/newsf/2026-11/20261108082228952.htm"},
    {"slug": "long-livephoto", "category": "tech",
     "sourceUrl": "https://news.qq.com/rain/a/20261108A0BQ2Z00"},
]

LOCALE_META = {
    "zh": {"source": "starteday 原创", "author": "starteday 编辑部", "read": 6},
    "en": {"source": "starteday Original", "author": "starteday Editorial", "read": 6},
    "ja": {"source": "starteday オリジナル", "author": "starteday 編集部", "read": 6},
    "ko": {"source": "starteday 오리지널", "author": "starteday 편집부", "read": 6},
    "es": {"source": "starteday Original", "author": "Redacción starteday", "read": 6},
    "fr": {"source": "starteday Original", "author": "Rédaction starteday", "read": 6},
    "pt": {"source": "starteday Original", "author": "Redação starteday", "read": 6},
    "tr": {"source": "starteday Özgün", "author": "starteday Editör", "read": 6},
}

# 汇总 4 个内容模块
all_data = {}
for m in ["a", "b", "c", "d"]:
    p = ROOT / ("content_11h_%s.py" % m)
    spec = importlib.util.spec_from_file_location("c11h_" + m, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for loc, arts in mod.DATA.items():
        all_data.setdefault(loc, []).extend(arts)

assert set(all_data) == set(LOCALE_META), set(all_data) ^ set(LOCALE_META)
for loc, arts in all_data.items():
    assert len(arts) == 3, (loc, len(arts))

for loc, arts in all_data.items():
    meta = LOCALE_META[loc]
    out = []
    for i, (t, a) in enumerate(zip(TOPICS, arts)):
        slug = t["slug"]
        imgs = ["/original/%s-cover.webp" % slug,
                "/original/%s-fig1.webp" % slug,
                "/original/%s-fig2.webp" % slug]
        out.append({
            "id": "rss-orig-%s-2026-11%s" % (slug, "" if loc == "zh" else "-" + loc),
            "title": a["title"],
            "summary": a["summary"],
            "cover": imgs[0],
            "images": imgs,
            "imageCount": 3,
            "tags": a["tags"],
            "category": t["category"],
            "locale": loc,
            "source": meta["source"],
            "sourceUrl": t["sourceUrl"],
            "author": meta["author"],
            "publishedAt": 0,
            "readMinutes": meta["read"],
            "pinned": 1,
            "body": a["body"],
        })
    fname = "premium-%s%s.json" % ("" if loc == "zh" else loc + "-", SUFFIX)
    (D / fname).write_bytes(
        (json.dumps(out, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
    print("%-34s %d 篇  body=%s" % (fname, len(out), [len(x["body"]) for x in out]))
print("[gen] 完成 8 文件 / 24 条")
