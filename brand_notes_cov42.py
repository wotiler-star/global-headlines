# -*- coding: utf-8 -*-
"""
brand_notes_cov42.py — 清理源码注释里残留的竞品/旧品牌指向。

品牌升级后代码里仍有一批「今日头条式」「对标头条」注释（UI 风格描述，不是品牌名），
保留会持续把新品牌和一个竞品绑在一起。只处理注释行，绝不改可见文案/逻辑。
bytes 读写保持换行不变。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "src"
REPL = [
    ("今日头条式", "信息流式"),
    ("对标今日头条", "参考主流资讯站"),
    ("对标头条", "参考信息流"),
    ("头条搜索式", "搜索结果式"),
    ("头条搜索页", "搜索页"),
    ("搜索页头条化", "搜索页两栏布局"),
    ("「头条热榜」", "「热榜」"),
]

files = [p for ext in ("*.ts", "*.tsx", "*.css") for p in ROOT.rglob(ext)]
total = 0
for f in files:
    lines = f.read_bytes().split(b"\n")
    n = 0
    for i, raw in enumerate(lines):
        s = raw.decode("utf-8", "ignore")
        # 仅注释行：// 或 /* 或 * 开头；代码里的 https:// 不含中文替换词，无副作用
        if not ("//" in s or "/*" in s or s.lstrip().startswith("*")):
            continue
        new = s
        for old, rep in REPL:
            new = new.replace(old, rep)
        if new != s:
            lines[i] = new.encode("utf-8")
            n += 1
    if n:
        f.write_bytes(b"\n".join(lines))
        total += n
        print(f"[notes] {f.relative_to(ROOT)}: {n} 行")
print(f"[notes] 共清理 {total} 行注释")
