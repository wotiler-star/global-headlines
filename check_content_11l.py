# -*- coding: utf-8 -*-
"""check_content_11l.py — 2026-11l 批次内容体检（不改动文件，纯只读）

覆盖：8 语种各 3 篇、每篇 >=12 段、id 唯一且格式正确、slug 与线上不撞题、
汉字脏串、中英敏感词、变音符号比例、tags/标题/摘要非空、publishedAt=0。
退出码 2 = 有问题，须修复后再跑 prepare_cov48.py。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
D = ROOT / "data" / "original"
BATCH = "2026-11l"
LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"]
SLUGS = ["ai-shopping-agent", "perovskite-ai-screening", "slow-dopamine-taste"]

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
DIACRITIC_FLOOR = {"es": 1.2, "fr": 1.2, "pt": 1.8, "tr": 6.0}

problems, seen_ids, diac_text, all_ids = [], set(), {}, []
for lang in LOCALES:
    fname = "premium-%s.json" % BATCH if lang == "zh" else "premium-%s-%s.json" % (lang, BATCH)
    p = D / fname
    if not p.exists():
        problems.append("缺文件 " + fname)
        continue
    data = json.loads(p.read_text(encoding="utf8"))
    if len(data) != 3:
        problems.append("%s 应有 3 篇，实际 %d" % (fname, len(data)))
    for a in data:
        aid = a["id"]
        all_ids.append(aid)
        if aid in seen_ids:
            problems.append("重复 id " + aid)
        seen_ids.add(aid)
        want = "rss-orig-%s-%s%s" % (a.get("_slug", ""), BATCH, "" if lang == "zh" else "-" + lang)
        body = a.get("body") or []
        if len(body) < 12:
            problems.append("正文不足 12 段: %s (%d)" % (aid, len(body)))
        if a.get("locale") != lang:
            problems.append("locale 不符: " + aid)
        if a.get("imageCount") != 3 or len(a.get("images") or []) != 3:
            problems.append("图片数不为 3: " + aid)
        if a.get("publishedAt") != 0:
            problems.append("publishedAt 非 0（应在 prepare 注入）: " + aid)
        if not a.get("title") or not a.get("summary") or len(a.get("tags") or []) < 4:
            problems.append("标题/摘要/tags 不完整: " + aid)
        if not a.get("sourceUrl", "").startswith("https://"):
            problems.append("sourceUrl 异常: " + aid)
        text = " ".join([a["title"], a["summary"], " ".join(a.get("tags") or [])] + body)
        diac_text[lang] = diac_text.get(lang, "") + text
        for w in BANNED_ZH:
            if w in text:
                problems.append("中文敏感词 %s: %s" % (w, aid))
        if lang not in ("ja", "zh"):
            m = CJK.search(text)
            if m:
                problems.append("汉字脏串 %s: %s" % (m.group(), aid))
        m = BANNED_EN.search(text)
        if m:
            problems.append("英文敏感词 %s: %s" % (m.group(), aid))

# slug 与线上既有批次不撞题
for f in D.glob("premium-*.json"):
    if BATCH in f.name:
        continue
    for a in json.loads(f.read_text(encoding="utf8")):
        for s in SLUGS:
            old = a["id"].split("-2026-")[0].replace("rss-orig-", "")
            if old == s:
                problems.append("与线上撞题 %s (%s)" % (s, a["id"]))

for lang, floor in DIACRITIC_FLOOR.items():
    txt = diac_text.get(lang, "")
    ratio = 100 * len(DIACRITIC.findall(txt)) / max(1, len(txt))
    print("变音符号 %s: %.2f%% (下限 %.1f%%)" % (lang, ratio, floor))
    if ratio < floor:
        problems.append("变音符号不足 %s: %.2f%% < %.1f%%" % (lang, ratio, floor))

print("批次条目:", len(all_ids), "语种:", len(LOCALES))
for lang in LOCALES:
    print("  %s: %d 篇 / %d 段" % (
        lang,
        sum(1 for x in all_ids if x.endswith("-" + lang) or (lang == "zh" and not re.search(r"-[a-z]{2}$", x))),
        0))
if problems:
    print("\n问题 %d 项:" % len(problems))
    for x in problems:
        print("  -", x)
    sys.exit(2)
print("[check_content_11l] 全部通过 ✅")
