# -*- coding: utf-8 -*-
"""check_content_11h.py — 内容模块发布前体检（本地预检，早于 prepare_cov48.py）"""
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
# 日语稿中明显是简体中文词/拉丁词的残留（日文常用汉字如 体制数点答 不算）
SUSPECT_JA = ["设置", "寻ね", "机制", "機制", "一堆", "益生菌", "这个", "问题", "实验", "回答", "研究团队", "数据", "设计"]

all_data = {}
for m in ["a", "b", "c", "d"]:
    p = ROOT / ("content_11h_%s.py" % m)
    spec = importlib.util.spec_from_file_location("c11h_" + m, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for loc, arts in mod.DATA.items():
        all_data.setdefault(loc, []).extend(arts)

problems = []
print("语种子数:", {k: len(v) for k, v in all_data.items()})
for loc, arts in all_data.items():
    txt_all = ""
    for i, a in enumerate(arts):
        txt = " ".join([a["title"], a["summary"], " ".join(a["tags"]), " ".join(a["body"])])
        txt_all += txt
        if len(a["body"]) < 12:
            problems.append("%s[%d] 正文仅 %d 段" % (loc, i, len(a["body"])))
        for w in BANNED_ZH:
            if w in txt:
                problems.append("%s[%d] 中文敏感词「%s」" % (loc, i, w))
        m = BANNED_EN.search(txt)
        if m:
            problems.append("%s[%d] 英文敏感词「%s」" % (loc, i, m.group()))
        if loc not in ("zh", "ja"):
            han = CJK.findall(txt)
            if han:
                problems.append("%s[%d] 汉字脏串 %s" % (loc, i, "".join(sorted(set(han)))[:40]))
        if loc == "pt" and "nube" in txt.lower():
            problems.append("pt[%d] 西语词 nube" % i)
        # 日语稿里的简体中文词残留（提示级）
        if loc == "ja":
            simp = [w for w in SUSPECT_JA if w in txt]
            if simp:
                problems.append("ja[%d] 疑似简体词 %s" % (i, simp))
        # 中文稿里残留英文单词（提示级，排除专有名词/缩写）
        if loc == "zh":
            stray = re.findall(r"\b[a-z]{4,}\b", txt)
            stray = [w for w in stray if w.lower() not in ("nad", "sirt", "lgr", "wifi", "nrma", "live", "photo", "sensor", "pro", "plus")]
            if stray:
                problems.append("zh[%d] 疑似英文残留 %s" % (i, sorted(set(stray))[:12]))
    if loc in FLOOR:
        ratio = 100 * len(DIACRITIC.findall(txt_all)) / len(txt_all)
        print("变音符号 %s: %.2f%% (下限 %.1f%%)" % (loc, ratio, FLOOR[loc]))
        if ratio < FLOOR[loc]:
            problems.append("变音符号不足 %s: %.2f%%" % (loc, ratio))
    print("%s: %d 篇, 正文段数 %s" % (loc, len(arts), [len(a["body"]) for a in arts]))

if problems:
    print("\n=== 待修问题 (%d) ===" % len(problems))
    for p in problems:
        print("  -", p)
else:
    print("\n[check] 全部通过 ✅")
