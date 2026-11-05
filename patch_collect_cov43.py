# -*- coding: utf-8 -*-
"""patch_collect_cov43.py — 给采集器加「导读==正文」源头过滤（bytes 精确替换 + 断言）"""
from pathlib import Path
import sys

p = Path(__file__).resolve().parent / "scripts/collect-articles.mjs"
s = p.read_bytes()

R = [
    (
        'import path from "path";',
        'import path from "path";\nimport { shouldPurge } from "./lead-dup.mjs";',
    ),
    (
        '  for (const a of byId.values()) {\n    if (String(a.id || "").startsWith("rss-orig-")) { reserved.push(a); continue; }',
        '  for (const a of byId.values()) {\n'
        '    // cov43：导读与全文正文一字不差的摘要稿不进镜像（prev 里的存量也会被清掉）\n'
        '    if (shouldPurge(a)) continue;\n'
        '    if (String(a.id || "").startsWith("rss-orig-")) { reserved.push(a); continue; }',
    ),
    (
        '  const mirror = mergeMirror(all);',
        '  const kept = all.filter((a) => !shouldPurge(a));\n'
        '  const mirror = mergeMirror(kept);',
    ),
    (
        '`[collect] 写入 data/articles.json（合并后 ${mirror.length} 条，本次新采 ${all.length} 条）`',
        '`[collect] 写入 data/articles.json（合并后 ${mirror.length} 条，本次新采 ${kept.length} 条，过滤低质量 ${all.length - kept.length} 条）`',
    ),
    (
        '  for (const a of all) {\n    stmt.run(',
        '  for (const a of kept) {\n    stmt.run(',
    ),
    (
        '本次 +${all.length} 条',
        '本次 +${kept.length} 条',
    ),
]

for old, new in R:
    ob, nb = old.encode("utf-8"), new.encode("utf-8")
    n = s.count(ob)
    if n != 1:
        sys.exit(f"[patch] 期望命中 1 次，实际 {n}: {old[:70]!r}")
    s = s.replace(ob, nb, 1)
    print(f"[patch] OK {old[:58]!r}")

p.write_bytes(s)
print("[patch] collect-articles.mjs 已加入源头过滤")
