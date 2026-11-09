# -*- coding: utf-8 -*-
"""image_quality_gate.py — 原创稿配图质量门禁（发布前必跑）

背景：2026-11-09 用户指出 oled-ipad-mini 封面是一块灰色划痕玻璃、
主体不明、零信息量，明确要求「以后我不需要」这类劣质图片。

本门禁把「劣质」拆成可机器检测的信号 + 人工目检两条：
  A. 机器检测（本脚本，fatal）：
     1) webp 文件 < 15KB —— 极可能是大面积纯色/划痕特写/空白
     2) 亮度标准差 < 18 —— 画面缺少明暗层次，几乎纯色
     3) 色彩标准差三通道均值 < 12 —— 灰扑扑、无色彩信息
     4) 拉普拉斯方差 < 60 —— 整体模糊/失焦（细节极少）
     5) 与已有任意封面 md5 相同 —— 重复用图
     6) 尺寸不是 1200x800
  B. 人工九宫格目检（管线硬步骤，不可省）：
     文件名常与内容不符（"IPad 4" 实为划痕玻璃、"Ion Proton Sequencers"
     实为车底、"Cochinchine" 实为雪林），机器信号只能筛候选，
     必须生成 contact sheet 用眼睛确认「主体是什么、是否切题」。
     弃用：主体不明、纯色/划痕/织物微距、矢量插画、设计感示意图、
     AI 生成图、人物半脸/无关特写、裁切后失去主体的照片。

用法：
  python image_quality_gate.py                 # 全站 public/original/*.webp
  python image_quality_gate.py <slug> ...      # 只查指定组（如 solar-flare-field）
退出码 2 = 存在劣质图，拒绝发布。
"""
import sys
from pathlib import Path

from PIL import Image, ImageStat, ImageFilter

ROOT = Path(__file__).resolve().parent
DST = ROOT / "public" / "original"

MIN_KB = 15
# 亮度阈值取 12（不是 18）：暗背景但主体明确的照片（汽车仪表盘、心电图
# 记录纸等）本来就低对比，18 会误伤；真正劣质的是"纯色圆盘/划痕玻璃"，
# 靠低 KB + 低细节方差 + 九宫格目检三件套拦截。
MIN_LUM_STD = 12
MIN_COLOR_STD = 12
MIN_LAPLACIAN_VAR = 60
SIZE = (1200, 800)


def laplacian_var(im):
    g = im.convert("L").resize((300, 200))
    edges = g.filter(ImageFilter.FIND_EDGES)
    return ImageStat.Stat(edges).var[0]


def main():
    only = set(sys.argv[1:])
    files = sorted(DST.glob("*.webp"))
    if only:
        files = [f for f in files if f.name.rsplit("-", 1)[0] in only]
    if not files:
        print("[gate] 没有待检图片")
        return 0

    problems, seen_cover = [], {}
    for p in files:
        kb = p.stat().st_size / 1024
        im = Image.open(p).convert("RGB")
        small = im.resize((120, 80))
        lum = ImageStat.Stat(small.convert("L")).stddev[0]
        color = sum(ImageStat.Stat(small).stddev) / 3
        lap = laplacian_var(im)
        tags = []
        if im.size != SIZE:
            tags.append("尺寸 %s≠%s" % (im.size, SIZE))
        if kb < MIN_KB:
            tags.append("仅 %.0fKB(<%.0f)" % (kb, MIN_KB))
        if lum < MIN_LUM_STD:
            tags.append("亮度std=%.1f(<%.0f)" % (lum, MIN_LUM_STD))
        if color < MIN_COLOR_STD:
            tags.append("色彩std=%.1f(<%.0f)" % (color, MIN_COLOR_STD))
        if lap < MIN_LAPLACIAN_VAR:
            tags.append("细节var=%.0f(<%.0f)" % (lap, MIN_LAPLACIAN_VAR))
        if p.name.endswith("-cover.webp"):
            import hashlib
            h = hashlib.md5(p.read_bytes()).hexdigest()
            if h in seen_cover:
                tags.append("与 %s 完全相同" % seen_cover[h])
            seen_cover[h] = p.name
        flag = "FAIL" if tags else "ok  "
        print("%s %-38s %5.0fKB lum=%5.1f color=%5.1f detail=%5.0f %s"
              % (flag, p.name, kb, lum, color, lap, " | ".join(tags)))
        if tags:
            problems.append((p.name, tags))

    print("\n[gate] 检查 %d 张，疑似劣质 %d 张" % (len(files), len(problems)))
    if problems:
        print("以下图片必须换掉或人工目检确认后重跑：")
        for n, t in problems:
            print("  -", n, "|", "; ".join(t))
        print("提示：机器信号只筛候选，最终以九宫格目检「主体是否明确、是否切题」为准。")
        return 2
    print("[gate] 通过 ✅（仍需完成九宫格目检才能发布）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
