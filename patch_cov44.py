# -*- coding: utf-8 -*-
"""patch_cov44.py — 内容重置配套代码改动（bytes 精确替换 + 断言）

1) collect-articles.mjs：data/.freeze 存在时跳过采集与写入（防止 2h 定时采集把删掉的文章抓回）
2) src/data/news.ts：内置示例稿不再参与任何兜底（否则首页/分类页仍显示几十篇 mock 文章）
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ---- 1. 采集冻结 ----
p = ROOT / "scripts/collect-articles.mjs"
s = p.read_bytes()
m = re.search(rb"async function main\(\)\s*\{", s)
if not m:
    sys.exit("[patch] 未找到 async function main()")
inject = (
    "\n"
    "  // cov44：内容冻结开关。data/.freeze 存在时完全跳过采集与写入，\n"
    "  // 让站点保持「3 篇原创策展稿」的干净状态；删除该文件即可恢复自动采集。\n"
    '  if (fs.existsSync(path.join("data", ".freeze"))) {\n'
    '    console.log("[collect] 内容冻结（data/.freeze）：跳过采集与写入。删除该文件可恢复自动采集。");\n'
    "    return;\n"
    "  }\n"
).encode("utf-8")
s = s[: m.end()] + inject + s[m.end() :]
p.write_bytes(s)
print("[patch] collect-articles.mjs 已加入 .freeze 冻结开关")

# ---- 2. 禁用内置示例稿 ----
p = ROOT / "src/data/news.ts"
s = p.read_bytes()
R = [
    (
        b"export function getArticles(locale: Locale, category?: Category): Article[] {\n"
        b"  let list = allArticles().filter((a) => a.locale === locale);",
        (
            "// cov44：站点内容重置为 3 篇原创策展稿，内置示例稿不再参与任何兜底。\n"
            "// 恢复示例数据：把 DISABLE_MOCK 改回 false 即可。\n"
            "const DISABLE_MOCK = true;\n\n"
            "export function getArticles(locale: Locale, category?: Category): Article[] {\n"
            "  if (DISABLE_MOCK) return [];\n"
            "  let list = allArticles().filter((a) => a.locale === locale);"
        ).encode("utf-8"),
    ),
    (
        b"export function getArticle(locale: Locale, id: string): Article | undefined {\n"
        b"  return allArticles().find((a) => a.locale === locale && a.id === id);",
        (
            "export function getArticle(locale: Locale, id: string): Article | undefined {\n"
            "  if (DISABLE_MOCK) return undefined;\n"
            "  return allArticles().find((a) => a.locale === locale && a.id === id);"
        ).encode("utf-8"),
    ),
]
for old, new in R:
    n = s.count(old)
    if n != 1:
        sys.exit(f"[patch] 期望命中 1 次，实际 {n}: {old[:60]!r}")
    s = s.replace(old, new, 1)
p.write_bytes(s)
print("[patch] src/data/news.ts 已禁用内置示例稿兜底")
