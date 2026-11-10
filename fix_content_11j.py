# -*- coding: utf-8 -*-
"""fix_content_11j.py — 精确修复 2026-11j 内容模块的串味词（bytes 读写保持 UTF-8/LF）"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

FIXES = {
    "content_11j_a.py": [
        ("超高效液相色谱 coupled 高分辨质谱", "超高效液相色谱联用高分辨质谱", 1),
        ("whose resonance is nonvolatively pinned to a wavelength, surviving power loss",
         "whose resonance stays pinned to a wavelength even after power loss", 1),
        ("part of the un describable in advance", "part of what cannot be described in advance", 1),
    ],
    "content_11j_b.py": [
        ("ヒトのメンデル randomization では", "ヒトのメンデル無作為化では", 1),
        ("メンデル randomization は全血eQTL", "メンデル無作為化は全血eQTL", 1),
        ("他人が要約した二手の情報", "他人が要約した又聞きの情報", 1),
        ("この移動は、连锁よりも", "この移動は、チェーンよりも", 1),
        ("という更难い問いを", "というより難しい問いを", 1),
        ("「少し少吃が効く」", "「少食が効く」", 1),
        (" 있고,后者는 원자 변위 결함에서 온다", " 있고, 후자는 원자 변위 결함에서 온다", 1),
        ("아직 못 한 부분도 equally 분명하다", "아직 못 한 부분도 마찬가지로 분명하다", 1),
        ("남이 요약한二手 정보라", "남이 요약한 간접 정보라", 1),
        ("정말 younger해진다", "정말 젊어진다", 1),
        ("보고서가建設은 무겁게 운영은 가볍게 한다고 경계하는 건",
         "보고서가 짓기는 무겁게 여기고 운영은 가볍게 여긴다고 경계하는 건", 1),
    ],
    "content_11j_c.py": [
        ("Une étude lipidomique跨 espèces", "Une étude lipidomique inter-espèces", 1),
        ("le bénéfice sanité établi", "le bénéfice sanitaire établi", 1),
        ("à l'échelle du wafer", "à l'échelle de la plaquette", 1),
    ],
    "content_11j_d.py": [
        ("convida à críticas dos revisores", "convida à crítica dos revisores", 1),
        ("lipit peroksidasyonuna yatkınlığı şüpheleniyor",
         "lipit peroksidasyonuna yatkınlığı öne sürüyor", 1),
    ],
}

for fname, items in FIXES.items():
    p = ROOT / fname
    b = p.read_bytes()
    for old, new, want in items:
        n = b.count(old.encode("utf8"))
        if n != want:
            raise SystemExit("FAIL %s: %r 命中 %d 次，期望 %d" % (fname, old[:30], n, want))
        b = b.replace(old.encode("utf8"), new.encode("utf8"))
    p.write_bytes(b)
    print("fixed", fname, len(items), "项")
print("[fix_content_11j] done")
