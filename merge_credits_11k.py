# -*- coding: utf-8 -*-
"""merge_credits_11k.py — 合并 CREDITS_new 到 CREDITS.json（27→30 组），并全量重建 imageCredits.ts（81→90 条）。
CREDITS.json 是单一真相源；imageCredits.ts 由它全量重建，保证一致。LF 写出。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CREDITS = ROOT / "public/original/CREDITS.json"
NEW = ROOT / "staging/2026-11k/CREDITS_new.json"
TS = ROOT / "src/lib/imageCredits.ts"

credits = json.loads(CREDITS.read_text(encoding="utf8"))
new = json.loads(NEW.read_text(encoding="utf8"))

before = len(credits)
collisions = [k for k in new if k in credits]
assert not collisions, f"slug 撞车: {collisions}"
credits.update(new)
after = len(credits)
print(f"CREDITS 组数: {before} -> {after}")

CREDITS.write_bytes((json.dumps(credits, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

# 全量重建 imageCredits.ts
lines = [
    "// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）",
    "// 数据来源：public/original/CREDITS.json；全量重建，保留历史批次署名",
    "export type ImageCredit = { artist: string; license: string; url: string };",
    "",
    "export const IMAGE_CREDITS: Record<string, ImageCredit> = {",
]
count = 0
for slug, grp in credits.items():
    entries = [grp.get("cover")] + list(grp.get("figs") or [])
    for e in entries:
        if not e:
            continue
        file = e["file"]
        artist = e["artist"].replace('"', '\\"')
        license_ = e["license"].replace('"', '\\"')
        url = e["commons_page"].replace("File:", "File%3A")
        lines.append(f'  "{file}": {{ artist: "{artist}", license: "{license_}", url: "{url}" }},')
        count += 1
lines.append("};")
TS.write_bytes(("\n".join(lines) + "\n").encode("utf8"))
print(f"IMAGE_CREDITS 条数: {count}")
