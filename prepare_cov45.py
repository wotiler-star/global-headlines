# -*- coding: utf-8 -*-
"""prepare_cov45.py — 发布前本地准备（幂等，bytes 改写保持换行）

1) premium JSON：注入真实发布时间戳（系统时钟）
2) 敏感主题扫描：政治 / 军事 / 宗教 / 种族 / 儿童，命中即拒绝发布
3) CREDITS.json：登记 9 张新配图的来源
4) collect-articles.mjs：.freeze 冻结逻辑 → 精选模式（不再抓 131 个 RSS 源）
5) reset-to-editorial.mjs：不再写 .freeze，改为移除它（恢复自动内容更新）
"""
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PREMIUM = ROOT / "data/original/premium-2026-11.json"
CREDITS = ROOT / "public/original/CREDITS.json"
COLLECT = ROOT / "scripts/collect-articles.mjs"
RESET = ROOT / "scripts/reset-to-editorial.mjs"

BANNED = [
    "政治", "政府", "选举", "总统", "议会", "国会", "外交", "关税", "制裁", "法案",
    "总理", "主席", "部长", "政党", "军事", "军队", "导弹", "武器", "战争", "作战",
    "防务", "战机", "宗教", "教会", "基督", "伊斯兰", "礼拜", "种族", "民族", "肤色",
    "儿童", "幼儿", "未成年人", "少年", "患儿",
]

# ---- 1. 时间戳（幂等）----
s = PREMIUM.read_bytes()
n = s.count(b'"publishedAt": 0')
if n == 3:
    now = int(time.time() * 1000)
    for i in range(3):
        s = s.replace(b'"publishedAt": 0', f'"publishedAt": {now - i * 180000}'.encode(), 1)
    PREMIUM.write_bytes(s)
    print("[prepare] 注入发布时间戳")
elif n == 0:
    print("[prepare] 时间戳已注入，跳过")
else:
    sys.exit(f"[prepare] publishedAt 占位符数量异常: {n}")
articles = json.loads(PREMIUM.read_text(encoding="utf8"))
print(f"[prepare] 文章数 {len(articles)}")

# ---- 2. 敏感主题扫描 ----
hits = []
for a in articles:
    text = "".join([a.get("title", ""), a.get("summary", ""), " ".join(a.get("tags", [])), "".join(a.get("body", []))])
    for w in BANNED:
        if w in text:
            hits.append((a["id"], w))
if hits:
    sys.exit(f"[prepare] 敏感主题命中，拒绝发布: {hits}")
print("[prepare] 敏感主题扫描：0 命中（政治/军事/宗教/种族/儿童）")

# ---- 3. CREDITS ----
credits = json.loads(CREDITS.read_text(encoding="utf8"))
GROUPS = {
    "spatial-glasses": "空间智能眼镜：从显示到理解空间",
    "edge-ai-chip": "低功耗边缘 AI 芯片：待机功耗降二十倍",
    "car-ai": "车载离线大模型：断网也能应答",
}
for key, title in GROUPS.items():
    entries = []
    for suffix in ["cover", "fig1", "fig2"]:
        f = ROOT / f"public/original/{key}-{suffix}.webp"
        entries.append({
            "file": f"/original/{key}-{suffix}.webp",
            "source": "AI generated (starteday editorial)",
            "license": "原创生成",
            "topic": title,
            "size_kb": round(f.stat().st_size / 1024),
        })
    credits[key] = {"cover": entries[0], "figs": entries[1:]}
CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print("[prepare] CREDITS.json 登记 9 张新图")

# ---- 4. 采集器：精选模式（幂等）----
s = COLLECT.read_text(encoding="utf8")
if "精选模式：跳过 RSS 全量采集" in s:
    print("[prepare] collect 已是精选模式，跳过")
else:
    marker = 'if (fs.existsSync(path.join("data", ".freeze"))) {'
    if marker not in s:
        sys.exit("[prepare] collect-articles.mjs 未找到 .freeze 逻辑")
    start = s.index("  // cov44：内容冻结开关")
    end = s.index("  }\n", s.index(marker)) + len("  }\n")
    new_block = (
        "  // cov45：站点改为「每次 3 篇原创策展稿」的编辑管线。\n"
        "  // 内容由定时任务写入 data/original/*.json，启动管线的 merge-originals.mjs 负责合并入库；\n"
        "  // 这里不再抓取 131 个 RSS 源，避免把低质量摘要稿重新灌回文章库。\n"
        "  // 应急恢复全量 RSS 采集：创建 data/.rss-on 文件。\n"
        '  if (!fs.existsSync(path.join("data", ".rss-on"))) {\n'
        '    console.log("[collect] 精选模式：跳过 RSS 全量采集；内容由 data/original/*.json 提供（应急恢复请创建 data/.rss-on）。");\n'
        "    return;\n"
        "  }\n"
    )
    s = s[:start] + new_block + s[end:]
    COLLECT.write_bytes(s.encode("utf8"))
    print("[prepare] collect-articles.mjs 改为精选模式")

# ---- 5. reset：移除 freeze（幂等）----
s = RESET.read_text(encoding="utf8")
if "恢复自动内容更新（cov45" in s:
    print("[prepare] reset 已改，跳过")
else:
    a = s.index("// ---- 2. 冻结采集 ----")
    b = s.index("// ---- 3. SQLite", a)
    s = s[:a] + (
        "// ---- 2. 恢复自动内容更新（cov45：采集器已改精选模式，不再依赖 .freeze）----\n"
        "if (fs.existsSync(FREEZE)) fs.rmSync(FREEZE);\n"
        'console.log("[reset] 已移除 data/.freeze（内容更新由编辑管线负责）");\n\n'
    ) + s[b:]
    RESET.write_bytes(s.encode("utf8"))
    print("[prepare] reset-to-editorial.mjs 改为移除 .freeze")
print("[prepare] 全部完成 ✅")
