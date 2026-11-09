# -*- coding: utf-8 -*-
"""gen_preview_11h.py — 生成本批 3 篇中文稿的可预览排版页（数据来自 11h JSON + CREDITS）"""
import html
import json
from pathlib import Path

ROOT = Path("F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
BASE = "https://starteday.com"
arts = json.loads((ROOT / "data/original/premium-2026-11h.json").read_text(encoding="utf8"))
credits = json.loads((ROOT / "public/original/CREDITS.json").read_text(encoding="utf8"))

CAT = {"science": "科学 · 天文", "health": "健康 · 生命科学", "tech": "消费 · 商业"}


def esc(s):
    return html.escape(str(s), quote=True)


def credit_block(slug):
    g = credits.get(slug)
    if not g:
        return ""
    rows = []
    for r in [g["cover"]] + list(g.get("figs", [])):
        label = "封面" if r["file"].endswith("cover.webp") else ("配图 1" if "fig1" in r["file"] else "配图 2")
        link = esc(r.get("commons_page") or "")
        rows.append(
            '<div class="cr-row"><span class="cr-lab">%s</span>'
            '<span class="cr-txt">%s · %s · <a href="%s" target="_blank" rel="noopener">Wikimedia Commons 原图 ↗</a></span></div>'
            % (label, esc(r.get("artist") or ""), esc(r.get("license") or ""), link))
    return '<div class="credits"><div class="credits-h">IMAGE CREDITS · 图片来源与许可</div>%s</div>' % "".join(rows)


cards = []
for a in arts:
    slug = a["id"].replace("rss-orig-", "").replace("-2026-11", "")
    imgs = a["images"]
    fig_html = ""
    for idx, im in enumerate(imgs):
        cap = ["封面", "配图一", "配图二"][idx]
        fig_html += (
            '<figure class="art-fig"><img src="%s%s" alt="%s" loading="lazy">'
            "<figcaption>%s · %s</figcaption></figure>"
            % (BASE, im, esc(a["title"]), cap, esc(Path(im).name))
        )
    tags = "".join('<span class="tag">%s</span>' % esc(t) for t in a["tags"])
    body = "".join("<p>%s</p>" % esc(p) for p in a["body"])
    cards.append("""
<article class="card" id="%s">
  <div class="card-top"><span class="cat">%s</span><span class="meta">%s · 约 %d 分钟阅读 · %d 段正文</span></div>
  <h2>%s</h2>
  <div class="summary">%s</div>
  <div class="tags">%s</div>
  <div class="hero"><img src="%s%s" alt="%s"></div>
  <div class="byline">%s · %s · <a href="%s" target="_blank" rel="noopener">原始报道 ↗</a></div>
  <div class="body">
    %s
    %s
  </div>
  %s
  <div class="links">
    <a class="btn" href="%s/zh/article/%s" target="_blank" rel="noopener">线上阅读（中文）↗</a>
    <a class="btn ghost" href="%s" target="_blank" rel="noopener">站点首页 ↗</a>
  </div>
</article>
""" % (
        esc(slug), esc(CAT.get(a["category"], a["category"])), esc(a["author"]),
        a["readMinutes"], len(a["body"]), esc(a["title"]), esc(a["summary"]), tags,
        BASE, imgs[0], esc(a["title"]), esc(a["author"]), esc(a["source"]), esc(a["sourceUrl"]),
        body, fig_html, credit_block(slug), BASE, esc(a["id"]), BASE,
    ))

nav = "".join(
    '<a href="#%s">%s</a>' % (
        esc(a["id"].replace("rss-orig-", "").replace("-2026-11", "")),
        esc(a["title"][:22] + "…"),
    ) for a in arts
)

doc = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>starteday · 2026-11-09 当日三篇原创</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f5f6f8;color:#1a1d24;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.85}
.wrap{max-width:860px;margin:0 auto;padding:0 20px 80px}
header{padding:44px 0 26px;border-bottom:2px solid #1a1d24;margin-bottom:28px}
.brand{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#6b7280;font-weight:700}
h1{font-size:30px;line-height:1.35;margin:12px 0 8px;letter-spacing:-.02em}
.sub{color:#5b6270;font-size:14px;margin:0}
.nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.nav a{font-size:12.5px;color:#334155;background:#fff;border:1px solid #dfe3e9;border-radius:20px;padding:6px 13px;text-decoration:none;transition:.18s}
.nav a:hover{background:#1a1d24;color:#fff;border-color:#1a1d24}
.card{background:#fff;border:1px solid #e6e8ec;border-radius:14px;padding:34px 36px 32px;margin:0 0 30px;box-shadow:0 2px 14px rgba(20,25,40,.04)}
.card-top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.cat{display:inline-block;font-size:12px;font-weight:700;color:#0b6bcb;background:#eaf3ff;border-radius:5px;padding:3px 10px;letter-spacing:.04em}
.meta{font-size:12px;color:#8a909c}
h2{font-size:25px;line-height:1.45;margin:18px 0 12px;letter-spacing:-.015em}
.summary{font-size:15.5px;color:#3f4654;background:#f7f9fc;border-left:3px solid #0b6bcb;padding:13px 16px;border-radius:0 8px 8px 0;margin:0 0 16px}
.tags{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}
.tag{font-size:11.5px;color:#5b6270;background:#f1f3f6;border:1px solid #e4e7ec;border-radius:4px;padding:3px 9px}
.hero{margin:0 0 10px;border-radius:10px;overflow:hidden;background:#eceff3}
.hero img{width:100%;display:block;aspect-ratio:3/2;object-fit:cover}
.byline{font-size:12px;color:#8a909c;margin:8px 0 26px}
.byline a{color:#0b6bcb;text-decoration:none}
.body p{font-size:15.5px;color:#2b303b;margin:0 0 17px;text-align:justify}
.art-fig{margin:26px 0;border-radius:9px;overflow:hidden;background:#eceff3;border:1px solid #eceff3}
.art-fig img{width:100%;display:block;aspect-ratio:3/2;object-fit:cover}
.art-fig figcaption{font-size:11.5px;color:#8a909c;padding:7px 12px;background:#fafbfc}
.credits{margin-top:30px;border:1px dashed #cfd6df;border-radius:9px;padding:16px 18px;background:#fafbfc}
.credits-h{font-size:11px;letter-spacing:.16em;font-weight:700;color:#6b7280;margin-bottom:10px}
.cr-row{display:flex;gap:10px;font-size:12.5px;color:#4b5260;margin:5px 0;flex-wrap:wrap}
.cr-lab{min-width:48px;color:#8a909c}
.cr-txt a{color:#0b6bcb;text-decoration:none}
.links{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
.btn{display:inline-block;font-size:13px;font-weight:600;color:#fff;background:#1a1d24;border-radius:7px;padding:9px 17px;text-decoration:none}
.btn.ghost{background:#fff;color:#1a1d24;border:1px solid #d5d9e0}
footer{text-align:center;color:#9aa0aa;font-size:12px;padding:20px 0 0}
@media(max-width:600px){.card{padding:22px 18px}h1{font-size:24px}h2{font-size:21px}.body p{font-size:15px}}
</style></head><body><div class="wrap">
<header>
  <div class="brand">starteday · 每日原创</div>
  <h1>2026 年 11 月 9 日 · 当日三篇原创长文</h1>
  <p class="sub">科技 / 健康 / 消费三个领域的实时热点二次创作 · 8 语种各 3 篇独立本地化稿 · 每篇 13 段正文 + 3 张 Commons 真实照片</p>
  <nav class="nav">{{NAV}}</nav>
</header>
{{CARDS}}
<footer>数据来源：Wikimedia Commons（CC BY / CC BY-SA / CC0 / Public Domain）· 全部图片为真实照片，页面内含可见署名</footer>
</div></body></html>
"""
doc = doc.replace("{{NAV}}", nav).replace("{{CARDS}}", "".join(cards))

out = ROOT / "preview_2026-11h.html"
out.write_bytes(doc.encode("utf8"))
print("written", out, len(doc), "bytes")
