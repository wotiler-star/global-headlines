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
# 每批 3 篇。cov61 起累计 4 个批次（premium-2026-11.json / -b / -c / -e），
# data/original/ 下所有 premium-*.json 都会被 merge-originals 与 reset 一起保留。
# 另有 premium-2026-11d.json 是单篇 zh 稿（另一会话添加、暂未上线），故 zh 多 1 篇。
# 续第五批时：各语种 +3；zh 的额外 +1 视 11d 是否上线而定。
EXPECT_COUNT = {loc: (13 if loc == "zh" else 12) for loc in EXPECTED}

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
        if a.get("publishedAt") in (0, None):
            a["publishedAt"] = now - i * 60000
            changed = True
        if len(a.get("body") or []) < 5:
            problems.append(f"正文过短: {aid}")
        if len(a.get("images") or []) != 3:
            problems.append(f"图片数不为 3: {aid}")
        text = " ".join([a.get("title", ""), a.get("summary", ""), " ".join(a.get("tags", [])), " ".join(a.get("body", []))])
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
print("按语种:", by_locale)
missing = EXPECTED - set(by_locale)
if missing:
    problems.append(f"缺少语种: {missing}")
for loc in EXPECTED:
    want = EXPECT_COUNT[loc]
    if by_locale.get(loc) != want:
        problems.append(f"{loc} 应有 {want} 篇，实际 {by_locale.get(loc, 0)}")

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
    fatal = [x for x in problems if "汉字脏串" in x or "重复 id" in x or "缺少语种" in x or "敏感词" in x]
    if fatal:
        sys.exit("存在致命问题，拒绝发布")
print("[prepare] 校验通过 ✅")
