# -*- coding: utf-8 -*-
"""archive_11k.py — 把本轮 2026-11j 产出归档为下一批 2026-11k 候选（并发会话已发布 11j，本轮不 deploy）
生成 8 个 premium[-lang]-2026-11k.json（publishedAt=0）、复制脚本、写 manifest.json。
不触碰 public/original、CREDITS.json、imageCredits.ts、prepare_cov48.py 等共享文件。
"""
import importlib.util
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
STAGE = ROOT / "staging" / "2026-11k"
JDIR = STAGE / "json"
SDIR = STAGE / "scripts"
for d in (STAGE, JDIR, SDIR):
    d.mkdir(parents=True, exist_ok=True)

SUFFIX = "2026-11k"
TOPICS = [
    {"slug": "photonic-memristor", "category": "science",
     "sourceUrl": "https://phy.sdu.edu.cn/info/1059/8637.htm"},
    {"slug": "lipid-chain-aging", "category": "health",
     "sourceUrl": "https://finance.sina.com.cn/roll/2026-11-10/doc-iniyexvn9504121.shtml"},
    {"slug": "hotel-content-economy", "category": "business",
     "sourceUrl": "https://www.163.com/dy/article/LBBVH8EI0514BTAB.html"},
]
LOCALE_META = {
    "zh": ("starteday 原创", "starteday 编辑部"),
    "en": ("starteday Original", "starteday Editorial"),
    "ja": ("starteday オリジナル", "starteday 編集部"),
    "ko": ("starteday 오리지널", "starteday 편집부"),
    "es": ("starteday Original", "Redacción starteday"),
    "fr": ("starteday Original", "Rédaction starteday"),
    "pt": ("starteday Original", "Redação starteday"),
    "tr": ("starteday Özgün", "starteday Editör"),
}

# 断言内容模块仍是本轮原创（防止并发会话覆盖后误归档他人稿件）
all_data = {}
for m in "abcd":
    p = ROOT / ("content_11j_%s.py" % m)
    spec = importlib.util.spec_from_file_location("arc_" + m, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for loc, arts in mod.DATA.items():
        all_data.setdefault(loc, []).extend(arts)
assert set(all_data) == set(LOCALE_META)
assert all(len(v) == 3 for v in all_data.values())
assert "铌酸锂" in all_data["zh"][0]["title"] or "光子" in all_data["zh"][0]["title"] or "存储器" in all_data["zh"][0]["title"], \
    "中文首篇主题不符，可能被并发会话覆盖"
for loc, arts in all_data.items():
    assert all(len(a["body"]) >= 13 for a in arts), loc

written = []
for loc, arts in all_data.items():
    src, author = LOCALE_META[loc]
    out = []
    for t, a in zip(TOPICS, arts):
        slug = t["slug"]
        imgs = ["/original/%s-cover.webp" % slug,
                "/original/%s-fig1.webp" % slug,
                "/original/%s-fig2.webp" % slug]
        out.append({
            "id": "rss-orig-%s-%s%s" % (slug, SUFFIX, "" if loc == "zh" else "-" + loc),
            "title": a["title"], "summary": a["summary"],
            "cover": imgs[0], "images": imgs, "imageCount": 3,
            "tags": a["tags"], "category": t["category"], "locale": loc,
            "source": src, "sourceUrl": t["sourceUrl"], "author": author,
            "publishedAt": 0, "readMinutes": 7, "pinned": 1,
            "body": a["body"],
        })
    fname = "premium-%s%s.json" % ("" if loc == "zh" else loc + "-", SUFFIX)
    (JDIR / fname).write_bytes((json.dumps(out, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
    written.append(fname)

SCRIPTS = [
    "content_11j_a.py", "content_11j_b.py", "content_11j_c.py", "content_11j_d.py",
    "gen_2026-11j.py", "check_content_11j.py", "fix_content_11j.py",
    "search_commons_11j.py", "fetch_commons_11j.py", "contact_sheet_11j.py",
    "build_images_11j.py", "commons_picks_11j.json", "image_quality_gate.py",
    "verify_2026-11j.js", "verify_online_concurrent_11j.js",
]
copied = []
for s in SCRIPTS:
    p = ROOT / s
    if p.exists():
        shutil.copy2(p, SDIR / s)
        copied.append(s)
for extra in ("downloads_11j.json", "src_for_11k.json", "CREDITS_new.json"):
    p = ROOT / extra
    if p.exists():
        shutil.copy2(p, STAGE / extra)
        copied.append(extra)

manifest = {
    "batch": "2026-11k",
    "status": "STAGED_NOT_PUBLISHED",
    "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    "reason": (
        "2026-11-10 自动化重复触发：并行会话已在 11:46 用同批次后缀 2026-11j 完成生产与部署"
        "（主题 china-ai-export / china-games-export / china-webnovel-global，线上 209 条）。"
        "按 skill 并发铁律，不覆盖同名 JSON、不重复 deploy；本轮 3 主题改为下一批候选归档。"
    ),
    "topics": [{"slug": t["slug"], "category": t["category"], "title": all_data["zh"][i]["title"]}
               for i, t in enumerate(TOPICS)],
    "online_after_concurrent": {
        "batch": "2026-11j", "articles": 209,
        "by_locale": {"zh": 27, "en": 26, "ja": 26, "ko": 26, "es": 26, "fr": 26, "pt": 26, "tr": 26},
        "slugs": ["china-ai-export", "china-games-export", "china-webnovel-global"],
    },
    "local_server_consistency": "11j 的 8 个 JSON / CREDITS.json / imageCredits.ts md5 与服务器完全一致，无需回滚",
    "files": {
        "json": written,
        "scripts": copied,
        "webp": "webp/（9 张 1200x800，九宫格目检后由 build_staging_11k.py 生成）",
        "credits": "CREDITS_new.json（3 组，下轮合并用；不直接改共享 CREDITS.json）",
    },
    "checks_passed_this_round": [
        "check_content_11j.py：8 语种各 3 篇 / 每篇 13-14 段 / 变音符号达标 / 0 敏感词 / 0 汉字脏串",
        "dup_check.py 2026-11j：措辞命中 0（改写 2 处报告名与专名后复跑）",
        "prepare_cov48.py：209 条 / zh27 其余 26 / 0 封面重复 / 0 同语种同题",
        "image_quality_gate.py 全站基线：72 张 0 劣质",
    ],
    "next_steps_when_publishing_11k": [
        "1. 只读检查服务器无 11k 批次、articles 条数（当前 209），无其它并发会话",
        "2. staging/2026-11k/json/*.json → data/original/（8 个文件）",
        "3. staging/2026-11k/webp/*.webp + 公共署名 → public/original/（9 张）",
        "4. CREDITS_new.json 的 3 组合并进 public/original/CREDITS.json（27 → 30 组），全量重建 imageCredits.ts（81 → 90 条）",
        "5. prepare_cov48.py 的 EXPECT_COUNT 改 zh 30 / 其余 29（累计 233 条）",
        "6. 跑 check_content + prepare + dup_check 2026-11k + image_quality_gate.py（全站 + 3 个 slug），并完成九宫格目检",
        "7. deploy：scp 8 JSON + 9 webp + CREDITS + imageCredits.ts；docker cp 8 JSON 进容器 volume；build/up；二次 reset + gen-rss + IndexNow 72；reload nginx",
        "8. Playwright 验收：8 语种首页各 3 篇链接、9 图 200、详情页标题/正文/署名、旧稿 404、0 应用控制台错误",
    ],
    "notes": [
        "本轮 3 主题与线上 24+3 个 slug 均不撞题，跨 science / health / business 三个分类",
        "图片来自 Wikimedia Commons 真实照片，禁止 AI 生成图；候选已排除军事/宗教/航天敏感与示意图",
        "发布前必须完成九宫格目检（机器门禁筛不出主体不明/名不符实）",
    ],
}
(STAGE / "manifest.json").write_bytes(
    (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
print("[archive_11k] staging/2026-11k/ 生成：%d 个 JSON、%d 个脚本/数据、manifest.json" % (len(written), len(copied)))
