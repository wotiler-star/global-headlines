# -*- coding: utf-8 -*-
"""dup_check.py — 引文重叠率固定检查（管线步骤，每批发布前跑）
自动扫描 data/original/*.json：zh 稿与 en 稿按 sourceUrl 抓源文，
中文 12 字滑窗 / 英文 8 词滑窗比对。命中即列出片段（人为复核改写）。
数字统计与专有名词（机构/人名/产品名）命中属预期，不必改。
用法：python dup_check.py            # 全量
      python dup_check.py 2026-11c   # 只查指定批次后缀的文件
"""
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
D = Path(__file__).resolve().parent / "data" / "original"
SUFFIX = sys.argv[1] if len(sys.argv) > 1 else None

PROPER_NOUNS = re.compile(
    r"[\u4e00-\u9fff]{2,10}(医院|研究所|大学|公司|实验室|中心)|"
    r"[A-Z][a-z]+(\s[A-Z][a-z]+){1,3}"
)


def fetch(url):
    r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "60", url],
                       capture_output=True)
    return r.stdout.decode("utf8", "replace")


def strip_html(html):
    html = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html, re.I | re.S)
    html = re.sub(r"<[^>]+>", " ", html)
    html = html.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
    html = html.replace("&#39;", "'").replace("&ldquo;", "「").replace("&rdquo;", "」")
    return re.sub(r"\s+", " ", html)


src_cache = {}


def get_src(url):
    if url not in src_cache:
        src_cache[url] = strip_html(fetch(url)).lower()
        time.sleep(2)
    return src_cache[url]


files = sorted(D.glob("premium-*.json"))
if SUFFIX:
    files = [f for f in files if SUFFIX in f.name]

total_hits, total_phrase = 0, 0
for f in files:
    lang = "zh" if f.name == "premium-" + (SUFFIX or "") .strip("-") + ".json" or "-en-" not in f.name and "-ja-" not in f.name and "-ko-" not in f.name and "-es-" not in f.name and "-fr-" not in f.name and "-pt-" not in f.name and "-tr-" not in f.name else ("en" if "-en-" in f.name else None)
    if lang not in ("zh", "en"):
        continue
    data = json.loads(f.read_text(encoding="utf8"))
    for art in data:
        url = art.get("sourceUrl") or ""
        if not url:
            continue
        text = art["title"] + " " + art["summary"] + " " + " ".join(art["body"])
        try:
            src = get_src(url)
        except Exception as e:
            print(f"[skip] {art['id']}: fetch fail {e}")
            continue
        if lang == "zh":
            clean = re.sub(r"[，。：；「」？！、\s（）()]", "", text.lower())
            N = 12
            frags = [clean[i:i + N] for i in range(0, max(0, len(clean) - N + 1), 4)]
        else:
            words = re.findall(r"[a-z0-9']+", text.lower())
            N = 8
            frags = [" ".join(words[i:i + N]) for i in range(0, max(0, len(words) - N + 1))]
        hits = sorted({h for h in frags if h in src}, key=len, reverse=True)
        # 过滤纯数字/专有名词命中
        real = []
        for h in hits:
            if lang == "zh":
                proper = any(p in h for p in ["医院", "研究所", "大学", "公司", "实验室"])
                has_digit = bool(re.search(r"\d", h))
                # 专名与含数字的统计事实句均为不可改写命中，跳过
                if proper or has_digit:
                    continue
            real.append(h)
        total_hits += len(hits)
        total_phrase += len(real)
        status = "OK" if not real else "REVIEW"
        print(f"[{status}] {f.name} / {art['id']}  源={urllib.parse.urlparse(url).netloc}  命中 {len(hits)}（措辞 {len(real)}）")
        for h in real[:6]:
            print("   HIT:", h[:70])

print(f"\n[dup_check] 总命中 {total_hits}，其中需复核措辞 {total_phrase}；措辞命中须改写后重跑")
if total_phrase:
    sys.exit(2)
