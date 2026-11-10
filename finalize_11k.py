# -*- coding: utf-8 -*-
"""finalize_11k.py — 补齐 staging/2026-11k 的图片/脚本/目检证据并更新 manifest"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STAGE = ROOT / "staging" / "2026-11k"
SDIR = STAGE / "scripts"
(STAGE / "contact_sheets").mkdir(exist_ok=True)

# 归档构建脚本与角色映射
for s in ["build_staging_11k.py", "archive_11k.py", "src_for_11k.json",
          "downloads_11j.json", "contact_sheet_11j_groups.py", "contact_sheet_11j.py"]:
    p = ROOT / s
    if p.exists():
        shutil.copy2(p, SDIR / s)

# 目检证据（3 张候选拼图 + 1 张成品九宫格 + 3 张分组原图拼图）
for p in sorted(ROOT.glob("contact_11j_*.png")) + [ROOT / "contact_11k_final.png"]:
    if p.exists():
        shutil.copy2(p, STAGE / "contact_sheets" / p.name)

# 原始候选图（供下轮复核/重排角色）
SRC_IMG = STAGE / "source_images"
SRC_IMG.mkdir(exist_ok=True)
for p in sorted((ROOT / "brand_real_11j").iterdir()):
    if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
        shutil.copy2(p, SRC_IMG / p.name)

mp = STAGE / "manifest.json"
m = json.loads(mp.read_text(encoding="utf8"))
webp = sorted((STAGE / "public" / "original").glob("*.webp"))
credits = json.loads((STAGE / "CREDITS_new.json").read_text(encoding="utf8"))

m["published"] = False
m["files"]["webp"] = ["public/original/" + p.name for p in webp]
m["files"]["credits"] = "CREDITS_new.json（3 组 / 9 条署名，下轮合并用；未改共享 CREDITS.json）"
m["files"]["contact_sheets"] = "contact_sheets/（3 张候选拼图 + 1 张裁切后成品九宫格）"
m["files"]["source_images"] = "source_images/（20 张 Commons 原图，供下轮重排角色）"
m["image_licenses"] = {
    k: [{"file": r["file"], "license": r["license"], "artist": r["artist"],
         "commons_page": r["commons_page"]} for r in [v["cover"]] + v["figs"]]
    for k, v in credits.items()
}
extra = [
    "image_quality_gate.py（staging 9 张单独跑）：0 劣质，全部 1200x800，KB/lum/color/detail 全达标",
    "两轮九宫格目检：20 张候选目检后弃用 11 张（大面积单色铌酸锂圆盘、带尺寸标注的示意图、黑白老照、灰底低信息量线虫图等）；定稿 9 张裁切后再目检，主体完整且切题",
    "线上并发批次 verify_online_concurrent_11j.js：87 PASS / 0 FAIL（9 图 200、8 语种首页各 3/3、详情页 14 段正文 + 署名区块、旧稿 404、0 应用错误）",
]
m["checks_passed_this_round"] += extra
m["online_verification"] = {
    "script": "verify_online_concurrent_11j.js",
    "pass": 87, "fail": 0,
    "articles": 209,
    "by_locale": {"zh": 27, "en": 26, "ja": 26, "ko": 26, "es": 26, "fr": 26, "pt": 26, "tr": 26},
}
m["important_concurrency_lesson"] = (
    "发布前只读检查（服务器无 11j / 185 条）通过之后，并行会话仍可能在我方跑到中途完成 11j 部署"
    "（服务器变 209 条）并覆盖本地同名 8 个 JSON、部署脚本、CREDITS 与 prepare。"
    "因此 deploy 之前必须【最后再查一次服务器批次与条数】，不能只依赖批次开始时的检查。"
)
mp.write_bytes((json.dumps(m, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
print("[finalize_11k] manifest 更新完成；webp=%d，源图=%d，署名组=%d"
      % (len(webp), len(list(SRC_IMG.iterdir())), len(credits)))
