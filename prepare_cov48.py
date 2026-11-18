# -*- coding: utf-8 -*-
"""prepare_cov48.py — 多语稿发布前校验与时间戳注入（bytes 写出，保持 LF）"""
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
D = ROOT / "data/original"
FILES = sorted(D.glob("premium-*.json"))
EXPECTED = {"zh", "en", "ja", "ko", "es", "fr", "pt", "tr"}
# 每批 3 篇。累计批次：a/b/c/e/f 五批各 3 篇 + d 的单篇 zh 稿 + g 三篇（f 与 e 同源同日，已随 11f 发布，无额外计数）。
# data/original/ 下所有 premium-*.json 都会被 merge-originals 与 reset 一起保留。
# premium-2026-11d.json 是另一会话添加、已上线的单篇 zh 稿，故 zh 比其余语种多 1 篇。
# 截至 11g：zh = 16 + 3 - 1 = 18，其余 = 15 + 3 - 1 = 17（减去 11f 与 11e 同源的 ultracold-space）。
# 11h 新增 3 主题 × 8 语种 = 24 条：各语种 +3 → zh 21 / 其余 20（累计 161 条）。
# 11i 由并行会话新增 3 主题 × 8 语种 = 24 条：各语种 +3 → zh 24 / 其余 23（累计 185 条）。
# 11j 新增 3 主题 × 8 语种 = 24 条：各语种 +3 → zh 27 / 其余 26（累计 209 条）。
# 11k 新增 3 主题 × 8 语种 = 24 条：各语种 +3 → zh 30 / 其余 29（累计 233 条）。续下一批(l)时：33/32。
EXPECT_COUNT = {loc: (30 if loc == "zh" else 29) for loc in EXPECTED}

# 变音符号下限（%）：防止非英语稿被 ASCII 化（2026-11-08 11g 首轮 es 0.65%/fr 0.03%/pt 0.01%/tr 0.32%）
DIACRITIC_FLOOR = {"es": 1.2, "fr": 1.2, "pt": 1.8, "tr": 6.0}
DIACRITIC = re.compile(r"[áéíóúñàâçèêëîïôûùüÿãõÁÉÍÓÚÑÀÂÇÃÕÜÖĞİŞığşçöü]")

BANNED_ZH = [
    "政治", "政府", "选举", "总统", "议会", "国会", "外交", "关税", "制裁", "法案",
    "总理", "主席", "部长", "政党", "军事", "军队", "导弹", "武器", "战争", "作战",
    "防务", "战机", "宗教", "教会", "基督", "伊斯兰", "礼拜", "种族", "民族", "肤色",
    "儿童", "幼儿", "未成年人", "少年", "患儿",
]
BANNED_EN = re.compile(
    r"\b(politics|government|election|president|parliament|diplomacy|tariff|sanction|"
    r"military|army|missile|weapon|warfare|religion|church|christian|islamic|"
    r"ethnic|racial|children|child|minors?)\b", re.I
)
CJK = re.compile(r"[\u4e00-\u9fff]")

now = int(time.time() * 1000)
seen, by_locale, problems = set(), {}, []
cover_owner = {}          # 封面图 -> slug（同一张照片用于【不同文章】才视为视觉重复；同 slug 的 8 语种版本共享一张封面是设计预期）
slug_by_locale = {}       # (locale, slug) -> id（同语种同题重复 = 同日同源重复报道）
diac_text = {}            # locale -> 拼接文本

for f in FILES:
    data = json.loads(f.read_text(encoding="utf8"))
    changed = False
    for i, a in enumerate(data):
        aid = a["id"]
        if aid in seen:
            problems.append(f"重复 id: {aid}")
        seen.add(aid)
        loc = a.get("locale")
        by_locale[loc] = by_locale.get(loc, 0) + 1
        if loc not in EXPECTED:
            problems.append(f"非法 locale: {loc} @ {aid}")
        # 同语种同题（slug 相同）
        m = re.match(r"rss-orig-(.+?)-2026-\d\d[a-z]?(-[a-z]{2})?$", aid)
        slug = m.group(1) if m else aid
        # 封面对撞：同一张照片用于【不同文章(slug)】才视为视觉重复；
        # 同一 slug 的 8 个语种版本共享一张封面是设计预期，不算重复。
        cv = a.get("cover") or (a.get("images") or [""])[0]
        if cv:
            if cv in cover_owner and cover_owner[cv] != slug:
                problems.append(f"封面重复 {cv}: {aid} 与 {cover_owner[cv]}")
            cover_owner.setdefault(cv, slug)
        if m:
            key = (loc, slug)
            if key in slug_by_locale and slug_by_locale[key] != aid:
                problems.append(f"同语种同题重复 {slug}: {aid} 与 {slug_by_locale[key]}")
            slug_by_locale.setdefault(key, aid)
        if a.get("publishedAt") in (0, None):
            a["publishedAt"] = now - i * 60000
            changed = True
        if len(a.get("body") or []) < 5:
            problems.append(f"正文过短: {aid}")
        if len(a.get("images") or []) != 3:
            problems.append(f"图片数不为 3: {aid}")
        text = " ".join([a.get("title", ""), a.get("summary", ""), " ".join(a.get("tags", [])), " ".join(a.get("body", []))])
        diac_text[loc] = diac_text.get(loc, "") + text
        for w in BANNED_ZH:
            if w in text:
                problems.append(f"中文敏感词 {w}: {aid}")
        if loc not in ("ja", "zh"):  # 中文原稿与日语本身使用汉字，跳过
            for ch in CJK.findall(text):
                problems.append(f"汉字脏串 {ch}: {aid}")
                break
        if BANNED_EN.search(text):
            problems.append(f"英文敏感词 {BANNED_EN.search(text).group()}: {aid}")
    # 仅在注入时间戳时回写，避免改动其它会话正在编辑的既有批次文件
    if changed:
        f.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

print("文件数:", len(FILES), "总条数:", len(seen))
print("按语种:", by_locale, "期望:", EXPECT_COUNT)
missing = EXPECTED - set(by_locale)
if missing:
    problems.append(f"缺少语种: {missing}")
for loc in EXPECTED:
    want = EXPECT_COUNT[loc]
    if by_locale.get(loc) != want:
        problems.append(f"{loc} 应有 {want} 篇，实际 {by_locale.get(loc, 0)}")

# 变音符号比例（非英语拉丁语族必须带重音，否则等于把本地化稿写成了 ASCII）
for loc, floor in DIACRITIC_FLOOR.items():
    txt = diac_text.get(loc, "")
    if not txt:
        continue
    ratio = 100 * len(DIACRITIC.findall(txt)) / len(txt)
    print("变音符号 %s: %.2f%% (下限 %.1f%%)" % (loc, ratio, floor))
    if ratio < floor:
        problems.append("变音符号不足 %s: %.2f%% < %.1f%%" % (loc, ratio, floor))

# 葡语误用的西语词（对所有 pt 批次文件生效）
for p in D.glob("premium-pt-*.json"):
    s = p.read_bytes()
    if b"nube" in s:
        s = s.replace(b"nube", b"nuvem")
        p.write_bytes(s)
        print("修正葡语 nube -> nuvem:", p.name)

if problems:
    print("\n问题:")
    for x in problems:
        print("  -", x)
    # 汉字脏串在非中文文件里属于致命错误
    fatal = [x for x in problems if "汉字脏串" in x or "重复 id" in x or "缺少语种" in x or "敏感词" in x
             or "变音符号不足" in x or "封面重复" in x or "同语种同题重复" in x]
    if fatal:
        sys.exit("存在致命问题，拒绝发布")
print("[prepare] 校验通过 ✅")
