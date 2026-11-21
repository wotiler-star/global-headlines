# -*- coding: utf-8 -*-
"""build_images_11q.py — 2026-11q 图片定稿构建

用法：
  python build_images_11q.py contact   # 生成候选九宫格拼图（目检用）
  python build_images_11q.py build     # 按 picks_11q.json 转 9 张 webp + CREDITS + imageCredits.ts + 3 og
"""
import json, re, sys, urllib.parse
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
REAL = ROOT / "brand_real_11q"
DST = ROOT / "public/original"
OGD = ROOT / "public/og"
CREDITS = DST / "CREDITS.json"
TS = ROOT / "src/lib/imageCredits.ts"
DL = ROOT / "downloads_11q.json"
PICKS = ROOT / "picks_11q.json"

dl = json.loads(DL.read_text(encoding="utf8"))
by_title = {v["title"]: v for v in dl["downloads"].values()}
info = dl["info"]

GROUPS = ["twisted-oxide-moire", "glucose-powered-neuroaxis", "folding-steering-suv"]


def contact():
    items = [v for v in dl["downloads"].values() if v.get("file")]
    cols, cw, ch = 6, 260, 190
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * ch), (245, 245, 245))
    dr = ImageDraw.Draw(sheet)
    for i, v in enumerate(items):
        p = REAL / v["file"]
        try:
            im = Image.open(p).convert("RGB")
            im.thumbnail((cw - 8, ch - 44), Image.LANCZOS)
            x, y = (i % cols) * cw, (i // cols) * ch
            sheet.paste(im, (x + (cw - im.width) // 2, y + 4))
            dr.text((x + 5, y + ch - 36), f"#{i+1:02d} {v['file']}", fill=(20, 20, 20))
            dr.text((x + 5, y + ch - 20), v["title"].replace("File:", "")[:38], fill=(90, 90, 90))
        except Exception as e:
            dr.text(((i % cols) * cw + 5, (i // cols) * ch + 5), f"BAD {v['file']}: {e}", fill=(200, 0, 0))
    out = ROOT / "contact_11q.png"
    sheet.save(out)
    print("CONTACT", out, sheet.size, "items", len(items))
    for i, v in enumerate(items):
        print(f"  #{i+1:02d} {v['file']:14s} {v['title']}")


def clean_artist(s):
    s = re.sub(r"^User:\s*", "", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:160] or "Wikimedia Commons contributor"


def convert(src, dst, size=(1200, 800)):
    im = Image.open(src).convert("RGB")
    sw, sh = im.size
    W, H = size
    scale = max(W / sw, H / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    if (nw, nh) != (sw, sh):
        im = im.resize((nw, nh), Image.LANCZOS)
    l, t = (nw - W) // 2, (nh - H) // 2
    im.crop((l, t, l + W, t + H)).save(dst, "WEBP", quality=88, method=6)
    return dst.stat().st_size


def build():
    picks = json.loads(PICKS.read_text(encoding="utf8"))
    credits = json.loads(CREDITS.read_text(encoding="utf8"))
    for slug in GROUPS:
        roles = picks[slug]
        grp = {"cover": None, "figs": []}
        for role in ("cover", "fig1", "fig2"):
            spec = roles[role]
            title = spec["title"] if isinstance(spec, dict) else spec
            d = by_title.get(title)
            if not d or not d.get("file"):
                raise SystemExit(f"MISSING DOWNLOAD: {title}")
            src = REAL / d["file"]
            out = f"{slug}-{role}.webp"
            sz = convert(src, DST / out)
            m = info.get(title, {})
            page = m.get("descriptionurl") or (
                "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe=":"))
            e = {
                "file": f"/original/{out}",
                "source": "Wikimedia Commons",
                "commons_title": title,
                "commons_page": page,
                "artist": spec.get("artist") if isinstance(spec, dict) and spec.get("artist") else clean_artist(m.get("artist")),
                "license": (spec.get("license") if isinstance(spec, dict) and spec.get("license") else (m.get("license") or "CC BY-SA 4.0")),
                "size_kb": round(sz / 1024),
            }
            if role == "cover":
                grp["cover"] = e
            else:
                grp["figs"].append(e)
            print(f"WEBP {out:44s} {sz:8d}B  {e['artist'][:34]:34s} {e['license']}")
        credits[slug] = grp
        # og 1200x630 从本组封面裁
        OGD.mkdir(parents=True, exist_ok=True)
        convert(DST / f"{slug}-cover.webp", OGD / f"{slug}.jpg", size=(1200, 630))
        print(f"OG   {slug}.jpg")

    CREDITS.write_bytes((json.dumps(credits, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

    def q(s):
        return json.dumps(str(s), ensure_ascii=False)

    lines = [
        "// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）",
        "// 数据来源：public/original/CREDITS.json；全量重建，保留历史批次署名",
        "export type ImageCredit = { artist: string; license: string; url: string };",
        "",
        "export const IMAGE_CREDITS: Record<string, ImageCredit> = {",
    ]
    for slug, grp in credits.items():
        for e in [grp["cover"]] + list(grp.get("figs") or []):
            if not e:
                continue
            lines.append(f'  {q(e["file"])}: {{ artist: {q(e["artist"])}, license: {q(e["license"])}, url: {q(e["commons_page"])} }},')
    lines.append("};")
    TS.write_bytes(("\n".join(lines) + "\n").encode("utf8"))
    print("CREDITS groups", len(credits), "imageCredits entries", len(lines) - 6)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "contact"
    if mode == "contact":
        contact()
    elif mode == "build":
        build()
    else:
        raise SystemExit("usage: contact | build")
