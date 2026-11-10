# -*- coding: utf-8 -*-
"""check_content_11j.py — 2026-11j 内容模块发布前体检"""
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

BANNED_ZH = [
    "政治", "政府", "选举", "总统", "议会", "国会", "外交", "关税", "制裁", "法案",
    "总理", "主席", "部长", "政党", "军事", "军队", "导弹", "武器", "战争", "作战",
    "防务", "战机", "宗教", "教会", "基督", "伊斯兰", "礼拜", "种族", "民族", "肤色",
    "儿童", "幼儿", "未成年人", "少年", "患儿",
]
BANNED_EN = re.compile(
    r"\b(politics|government|election|president|parliament|diplomacy|tariff|sanction|"
    r"military|army|missile|weapon|warfare|religion|church|christian|islamic|"
    r"ethnic|racial|children|child|minors?)\b", re.I)
CJK = re.compile(r"[\u4e00-\u9fff]")
DIACRITIC = re.compile(r"[áéíóúñàâçèêëîïôûùüÿãõÁÉÍÓÚÑÀÂÇÃÕÜÖĞİŞığşçöü]")
FLOOR = {"es": 1.2, "fr": 1.2, "pt": 1.8, "tr": 6.0}
# 拉丁词混入东亚语文（列出常见的串味词，人工复核）
STRAY_LATIN = re.compile(
    r"\b(coupled|equally|younger|randomization|un describable|nonvolatively|"
    r"to|the|and|of|is|in|with|for|from|that|this|建设|二手|后者|连锁|更难)\b", re.I)

all_data = {}
for m in ["a", "b", "c", "d"]:
    p = ROOT / ("content_11j_%s.py" % m)
    spec = importlib.util.spec_from_file_location("c11j_" + m, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for loc, arts in mod.DATA.items():
        all_data.setdefault(loc, []).extend(arts)

problems = []
print("语种子数:", {k: len(v) for k, v in all_data.items()})
for loc, arts in all_data.items():
    txt_all = ""
    for i, a in enumerate(arts):
        fields = [a["title"], a["summary"], " ".join(a["tags"]), " ".join(a["body"])]
        txt = " ".join(fields)
        txt_all += txt
        if len(a["body"]) < 13:
            problems.append("%s[%d] 正文仅 %d 段（需 >=13）" % (loc, i, len(a["body"])))
        for w in BANNED_ZH:
            if w in txt:
                problems.append("%s[%d] 中文敏感词 %s" % (loc, i, w))
        hit = BANNED_EN.search(txt)
        if hit:
            problems.append("%s[%d] 英文敏感词 %s" % (loc, i, hit.group()))
        if loc not in ("ja", "zh"):
            bad = CJK.findall(txt)
            if bad:
                for ch in sorted(set(bad)):
                    idx = txt.find(ch)
                    problems.append("%s[%d] 汉字脏串 %r ...%s..." % (loc, i, ch, txt[max(0, idx-25):idx+25]))
        if loc in ("zh", "ja", "ko"):
            for mt in STRAY_LATIN.finditer(txt):
                problems.append("%s[%d] 串味词 %r ...%s..." % (loc, i, mt.group(), txt[max(0, mt.start()-30):mt.end()+30]))
    ratio = 100 * len(DIACRITIC.findall(txt_all)) / max(1, len(txt_all))
    print("变音符号 %s: %.2f%% (下限 %.1f%%)" % (loc, ratio, FLOOR.get(loc, 0)))
    if loc in FLOOR and ratio < FLOOR[loc]:
        problems.append("%s 变音符号不足 %.2f%% < %.1f%%" % (loc, ratio, FLOOR[loc]))

print("\n=== 问题 %d 项 ===" % len(problems))
for x in problems:
    print("  -", x)
if problems:
    sys.exit(2)
print("[check_content_11j] 全绿 ✅")
