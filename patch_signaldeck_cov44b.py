# -*- coding: utf-8 -*-
"""patch_signaldeck_cov44b.py — 文章库清空后 SignalDeck 的空数据保护

崩溃点：regions 为空 → peak 为 undefined → 客户端水合时读 peak.name 抛
「Cannot read properties of undefined (reading 'name')」，整页变 Application error。
"""
import sys
from pathlib import Path

p = Path(__file__).resolve().parent / "src/components/SignalDeck.tsx"
s = p.read_bytes()

R = [
    (
        b"  const peak = [...regions].sort((a, b) => b.signalCount - a.signalCount)[0];",
        (
            "  // cov44b：文章库可为空（内容重置态），peak 允许为 null，下游一律兜底\n"
            "  const peak = [...regions].sort((a, b) => b.signalCount - a.signalCount)[0] || null;"
        ).encode("utf-8"),
    ),
    (
        b"    focusRegion(peak.code);\n    scrollToCode(peak.code);",
        b"    if (!peak) return;\n    focusRegion(peak.code);\n    scrollToCode(peak.code);",
    ),
    (
        b"                PEAK {peak.name} {peak.signalCount}",
        b"                PEAK {peak ? peak.name : \"\xe2\x80\x94\"} {peak ? peak.signalCount : 0}",
    ),
    (
        b"{peak.name} \xc2\xb7 <CountUp value={peak.signalCount} />",
        b"{peak ? peak.name : \"\xe2\x80\x94\"} \xc2\xb7 <CountUp value={peak ? peak.signalCount : 0} />",
    ),
]
for old, new in R:
    n = s.count(old)
    if n != 1:
        sys.exit(f"[patch] 期望命中 1 次，实际 {n}: {old[:70]!r}")
    s = s.replace(old, new, 1)
    print(f"[patch] OK {old[:60]!r}")
p.write_bytes(s)
print("[patch] SignalDeck.tsx 已加空数据保护")
