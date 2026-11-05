# -*- coding: utf-8 -*-
"""
brand_assets_cov41.py — starteday 品牌资产生成（Pillow，无外部 SVG 渲染依赖）

产出：
  public/icons/icon-192.png            PWA 图标
  public/icons/icon-512.png            PWA 图标
  public/icons/icon-maskable-512.png   Android maskable（安全区 80%）
  src/app/favicon.ico                  16/32/48/64 多尺寸 ico
  public/brand/og-cover.png           1200×630 社交分享卡
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BRAND = "start" + "eday"
SITE = BRAND.upper() + ".COM"
GOLD = (255, 179, 71)
MID = (255, 122, 61)
EMBER = (240, 81, 42)
INK = (10, 14, 20)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient(size):
    """135° 观感的纵向三段渐变（晨曦金 → 日出橙 → 余烬红）"""
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        c = lerp(GOLD, MID, t / 0.52) if t < 0.52 else lerp(MID, EMBER, (t - 0.52) / 0.48)
        d.line([(0, y), (size, y)], fill=(*c, 255))
    return img


def make_mark(size, maskable=False):
    """日轮 + 地平线，与 public/icon.svg / BrandMark.tsx 的 64 viewBox 严格同构"""
    S = size * 3
    grad = gradient(S)
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if maskable:
        base.paste(grad, (0, 0))
    else:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.219), fill=255)
        base.paste(grad, (0, 0), mask)

    k = 0.8 if maskable else 1.0
    off = 6.4 if maskable else 0.0

    def X(v):
        return int((off + v * k) * S / 64)

    def W(v):
        return max(1, int(v * k * S / 64))

    ov = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([X(20), X(15), X(44), X(39)], fill=(255, 255, 255, 255))
    d.line([(X(10), X(41)), (X(54), X(41))], fill=(255, 255, 255, 255), width=W(5))
    d.line([(X(18), X(50)), (X(46), X(50))], fill=(255, 255, 255, 150), width=W(4))
    base = Image.alpha_composite(base, ov)
    return base.resize((size, size), Image.LANCZOS)


def font(path, size, fallback=20):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size=fallback)


# ------------------------------------------------------------------ PWA / favicon
(ROOT / "public/icons").mkdir(parents=True, exist_ok=True)
(ROOT / "public/brand").mkdir(parents=True, exist_ok=True)

make_mark(192).save(ROOT / "public/icons/icon-192.png")
make_mark(512).save(ROOT / "public/icons/icon-512.png")
make_mark(512, maskable=True).save(ROOT / "public/icons/icon-maskable-512.png")
make_mark(256).save(
    ROOT / "src/app/favicon.ico", format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
)
# iOS 添加到主屏：方底不透明（iOS 自己加圆角，透明角会变黑）
make_mark(180, maskable=True).convert("RGB").save(ROOT / "public/apple-touch-icon.png")
print("[assets] icons 192/512/maskable + favicon.ico + apple-touch-icon")

# ------------------------------------------------------------------ OG 分享卡
W, H = 1200, 630
img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img)

# 右侧：低透明度的大型日轮 + 地平线（品牌图形放大作背景节奏）
deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
dd.ellipse([760, 96, 1140, 476], fill=(*MID, 38))
dd.ellipse([812, 148, 1088, 424], fill=(*GOLD, 46))
dd.line([(720, 470), (1180, 470)], fill=(*MID, 90), width=7)
dd.line([(800, 508), (1100, 508)], fill=(*MID, 44), width=5)
img = Image.alpha_composite(img.convert("RGBA"), deco).convert("RGB")
d = ImageDraw.Draw(img)

# 左侧：品牌锚条 + 标记 + 字标
d.rectangle([80, 150, 86, 470], fill=EMBER)
mark = make_mark(92)
img.paste(mark, (120, 168), mark)
d = ImageDraw.Draw(img)

f_word = font("C:/Windows/Fonts/segoeuib.ttf", 96)
x, y = 120, 290
d.text((x, y), "start", font=f_word, fill=(232, 238, 245))
x2 = x + d.textlength("start", font=f_word)
d.text((x2, y), "eday", font=f_word, fill=(255, 146, 72))
d.ellipse([x2 + d.textlength("eday", font=f_word) + 8, y + 74,
           x2 + d.textlength("eday", font=f_word) + 21, y + 87], fill=(255, 209, 102))

f_cn = font("C:/Windows/Fonts/msyhbd.ttc", 30)
f_sm = font("C:/Windows/Fonts/segoeui.ttf", 20)
d.text((122, 420), "从这里，开始每一天", font=f_cn, fill=(147, 164, 184))
d.text((122, 480), f"{SITE}   ·   GLOBAL NEWS, EVERY DAY", font=f_sm, fill=(117, 131, 154))
d.line([(80, 552), (1120, 552)], fill=(30, 40, 54), width=2)
d.line([(80, 552), (300, 552)], fill=EMBER, width=3)

img.save(ROOT / "public/brand/og-cover.png", optimize=True)
print("[assets] brand/og-cover.png 1200x630")
print("BRAND ASSETS OK ->", BRAND)
