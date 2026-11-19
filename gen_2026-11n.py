# -*- coding: utf-8 -*-
"""gen_2026-11n.py — 汇总 8 语种独立原创稿，注入公共字段，写出 8 个 premium JSON。

content_11n_<lang>.py 只提供 title / summary / tags / body（各自独立撰写）。
公共字段（id、图片、category、sourceUrl、按语种本地化的 author/source、
publishedAt=0）在此统一注入，避免 8 份文件手工维护产生漂移。
"""
import importlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "original"
BATCH = "2026-11n"
SLUGS = ["locust-cannibalism-scent", "fluorinated-electrolyte-battery", "smart-floss-metabolism"]
LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"]

SOURCE_URL = {
    "locust-cannibalism-scent": "https://caas.cn/xwzx/tpxw/723a9117ba3f491ab6d76c57784983a6.htm",
    "fluorinated-electrolyte-battery": "https://news.qq.com/rain/a/20261118A0BT3T00",
    "smart-floss-metabolism": "https://www.163.com/dy/article/LC39GVRD05561FYF_pdya11y.html",
}
CATEGORY = {
    "locust-cannibalism-scent": "science",
    "fluorinated-electrolyte-battery": "tech",
    "smart-floss-metabolism": "health",
}
AUTHOR = {
    "zh": "starteday 编辑部", "en": "starteday Editorial", "ja": "starteday 編集部",
    "ko": "starteday 편집부", "es": "Redacción starteday", "fr": "Rédaction starteday",
    "pt": "Redação starteday", "tr": "starteday Editör",
}
SOURCE = {
    "zh": "starteday 原创", "en": "starteday Original", "ja": "starteday オリジナル",
    "ko": "starteday 오리지널", "es": "starteday Original", "fr": "starteday Original",
    "pt": "starteday Original", "tr": "starteday Özgün",
}


def main():
    for lang in LOCALES:
        mod = importlib.import_module("content_11n_" + lang)
        assert len(mod.ARTICLES) == 3, "%s 应有 3 篇" % lang
        arts = []
        for i, raw in enumerate(mod.ARTICLES):
            slug = SLUGS[i]
            aid = "rss-orig-%s-%s%s" % (slug, BATCH, "" if lang == "zh" else "-" + lang)
            imgs = ["/original/%s-%s.webp" % (slug, r) for r in ("cover", "fig1", "fig2")]
            body = raw["body"]
            assert len(body) >= 12, "%s/%s 正文仅 %d 段" % (lang, slug, len(body))
            arts.append({
                "id": aid,
                "title": raw["title"],
                "summary": raw["summary"],
                "cover": imgs[0],
                "images": imgs,
                "imageCount": 3,
                "tags": raw["tags"],
                "category": CATEGORY[slug],
                "locale": lang,
                "source": SOURCE[lang],
                "sourceUrl": SOURCE_URL[slug],
                "author": AUTHOR[lang],
                "publishedAt": 0,
                "readMinutes": 7,
                "pinned": 1,
                "body": body,
            })
        fname = "premium-%s.json" % BATCH if lang == "zh" else "premium-%s-%s.json" % (lang, BATCH)
        (OUT / fname).write_bytes(
            (json.dumps(arts, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
        print("%-40s %d 篇 / %d 段" % (fname, len(arts), sum(len(a["body"]) for a in arts)))
    print("[gen_2026-11n] 8 语种共 24 篇写出完成")


if __name__ == "__main__":
    main()
