# -*- coding: utf-8 -*-
"""patch_article_credits_cov48.py — 文章页显示 Wikimedia Commons 图片署名（CC 许可合规）"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
P = ROOT / "src/app/[locale]/article/[id]/page.tsx"
s = P.read_bytes()

R = [
    (
        'import { absUrl, buildArticleAlternates, SITE_URL } from "@/lib/site";',
        'import { absUrl, buildArticleAlternates, SITE_URL } from "@/lib/site";\n'
        'import { IMAGE_CREDITS } from "@/lib/imageCredits";',
    ),
    (
        '                    <figcaption>\n'
        '                      FIG.{String(figMap.get(i)!.no).padStart(2, "0")} · {article.source}\n'
        '                    </figcaption>',
        '                    <figcaption>\n'
        '                      FIG.{String(figMap.get(i)!.no).padStart(2, "0")} · '
        '{IMAGE_CREDITS[figMap.get(i)!.src]?.artist || article.source}\n'
        '                      {IMAGE_CREDITS[figMap.get(i)!.src]?.license\n'
        '                        ? ` · ${IMAGE_CREDITS[figMap.get(i)!.src]!.license}`\n'
        '                        : ""}\n'
        '                    </figcaption>',
    ),
    (
        '          <WaveformDivider paragraphs={article.body.length} minutes={readMin} />',
        '          <WaveformDivider paragraphs={article.body.length} minutes={readMin} />\n'
        '          {(article.images || []).some((p) => IMAGE_CREDITS[p]) && (\n'
        '            <section className="art-image-credits" aria-label="图片来源">\n'
        '              <div className="aic-label">IMAGE CREDITS · 图片来源</div>\n'
        '              <ul>\n'
        '                {(article.images || []).filter((p) => IMAGE_CREDITS[p]).map((p) => (\n'
        '                  <li key={p}>\n'
        '                    <a href={IMAGE_CREDITS[p].url} target="_blank" rel="noopener noreferrer">\n'
        '                      {p.split("/").pop()}\n'
        '                    </a>\n'
        '                    {" · "}{IMAGE_CREDITS[p].artist}{" · "}{IMAGE_CREDITS[p].license}{" · Wikimedia Commons"}\n'
        '                  </li>\n'
        '                ))}\n'
        '              </ul>\n'
        '            </section>\n'
        '          )}',
    ),
]
for old, new in R:
    ob, nb = old.encode("utf-8"), new.encode("utf-8")
    n = s.count(ob)
    if n != 1:
        sys.exit(f"[patch] 期望 1 次，实际 {n}: {old[:70]!r}")
    s = s.replace(ob, nb, 1)
P.write_bytes(s)
print("[patch] 文章页已加入图片署名")

css = ROOT / "src/app/globals.css"
c = css.read_bytes()
block = (
    "\n/* cov48：Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 合规） */\n"
    ".art-image-credits { margin: 26px 0; padding: 14px 16px; border: 1px solid var(--line); "
    "border-radius: 8px; background: var(--surface); font-size: 12px; color: var(--ink-3); }\n"
    ".art-image-credits .aic-label { font-family: var(--font-mn); letter-spacing: 0.12em; "
    "color: var(--brand); margin-bottom: 8px; }\n"
    ".art-image-credits ul { margin: 0; padding-left: 18px; line-height: 1.9; }\n"
    ".art-image-credits a { color: var(--brand); text-decoration: underline; }\n"
).encode("utf-8")
if b".art-image-credits" not in c:
    css.write_bytes(c + block)
    print("[patch] globals.css 已加署名样式")
