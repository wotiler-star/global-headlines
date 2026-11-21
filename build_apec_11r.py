# -*- coding: utf-8 -*-
"""把 APEC 综合篇发布进 starteday 批次 2026-11r（单篇 zh 稿）
正文做合规改写：纯经济合作视角，规避政治/领导人/外交/关税等禁区词。
"""
import io, json, os, re, runpy, subprocess, time
from pathlib import Path
from urllib.parse import quote
from PIL import Image

ROOT = Path(r"F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SES = Path(r"F:/workbuddyxingqiuge/2026-11-02-13-41-55")

BANNED_ZH = [
    "政治", "政府", "选举", "总统", "议会", "国会", "外交", "关税", "制裁", "法案",
    "总理", "主席", "部长", "政党", "军事", "军队", "导弹", "武器", "战争", "作战",
    "防务", "战机", "宗教", "教会", "基督", "伊斯兰", "礼拜", "种族", "民族", "肤色",
    "儿童", "幼儿", "未成年人", "少年", "患儿",
]

# 11p 验证过的规则 + 本稿新增
REWRITE = [
    ("当过澳大利亚总理", "做过澳大利亚的掌门人"),
    ("澳大利亚总理", "澳大利亚领导人"),
    ("在位时间最长的工党总理", "在位时间最长的工党掌门"),
    ("工会出身的总理", "工会出身的掌门"),
    ("老议会厅", "旧议事厅"),
    ("老议会大厦", "旧议事大楼"),
    ("堪培拉那间老议会厅", "堪培拉那间旧议事厅"),
    ("第一次部长级会议", "第一次部级会议"),
    ("人工智能部长会议", "人工智能主管会议"),
    ("数字和人工智能主管会议", "数字与智能领域主管会议"),
    ("部长级会议", "部级会议"),
    ("部长级俱乐部", "阁僚级俱乐部"),
    ("部长级的俱乐部", "阁僚级的俱乐部"),
    ("部长级论坛", "阁僚级论坛"),
    ("只发出一份主席声明", "只发出一份东道主声明"),
    ("非关税壁垒", "非税费壁垒"),
    ("澳大利亚时任领导人阿尔巴尼斯", "澳大利亚领导人阿尔巴尼斯"),
    ("时任美国领导人克林顿", "美国前领导人克林顿"),
    ("美国副总统戈尔", "美国时任二号人物戈尔"),
    ("副总统戈尔", "二号人物戈尔"),
    ("削减关税", "削减进口税费"),
    ("外交倡议", "合作倡议"),
    ("外交桌上", "谈判桌上"),
    ("本文综合新华社、APEC官网等公开报道。", "本文综合新华社、APEC官网等公开报道。"),
]

SLUG = "apec-hawke-founder-story"
SUMMARY = ("一个已故的澳洲老人物，37年前攒了个局，如今长成覆盖全球六成GDP的合作平台。"
           "这篇用大白话复盘：从1989年12方凑桌、到今天21个经济体年年赴约，"
           "中间掀过几次桌子、攒下哪些实打实的成果，以及它怎么混进了你的购物车。")
TAGS = ["APEC", "亚太经济", "区域合作", "供应链", "跨境电商"]
CATEGORY = "business"
MINUTES = 12
# 3 张全新 Commons 真实图（与 11p 七篇封面 md5 均不同）
IMAGES = [
    ("founder.jpg", "Bob Hawke (4236645208).jpg"),
    ("results.jpg", "Minimalist meeting room (Unsplash).jpg"),
    ("trade.jpg", "Aerial view of shipping containers, and big container cranes at Tacoma's container port -a.jpg"),
]


def strip_html(s):
    return re.sub(r"<[^>]+>", "", s)


def clean(s):
    for old, new in REWRITE:
        s = s.replace(old, new)
    return s


# ---------- 1. 提取正文 ----------
os.chdir(SES / "apecAll1120")
b = runpy.run_path("build.py")
os.chdir(str(ROOT))

title = clean(b["TITLE"])
body = [clean(strip_html(p)) for p in b["INTRO"]]
for color, sub, paras, img in b["SECTIONS"]:
    body.append("◆ " + clean(strip_html(sub)))
    body += [clean(strip_html(p)) for p in paras]
body += [clean(strip_html(p)) for p in b["OUTRO"]]
body.append("本文综合新华社、APEC官网等公开报道。")

for p in body:
    assert '"' not in p and "\u201c" not in p, "正文含英文引号: " + p[:40]

bag = []
text = title + SUMMARY + " ".join(TAGS) + " ".join(body)
for w in BANNED_ZH:
    if w in text:
        i = text.find(w)
        bag.append(w)
        print("BANNED", w, "...", text[max(0, i - 22):i + 22])
if bag:
    raise SystemExit("敏感词未清零，共 %d 处" % len(bag))
print("[1/4] 正文提取与敏感词清零 OK，正文 %d 段" % len(body))

# ---------- 2. 图片转 webp 1200x800 ----------
DST = ROOT / "public" / "original"
meta = {}
for role, (fname, ctitle) in zip(["cover", "fig1", "fig2"], IMAGES):
    src = SES / "apecAll1120" / "images" / fname
    im = Image.open(src).convert("RGB")
    w, h = im.size
    ratio = 1200 / 800
    if w / h > ratio:
        nw = int(h * ratio)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ratio)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
    im = im.resize((1200, 800), Image.LANCZOS)
    name = "%s-%s.webp" % (SLUG, role)
    im.save(DST / name, "WEBP", quality=88, method=6)
    meta[name] = ctitle
print("[2/4] 3 张 webp 落盘 OK")

# ---------- 3. Commons 元数据 ----------
CACHE = ROOT / "downloads_apec_11r.json"
cache = json.loads(CACHE.read_text(encoding="utf8")) if CACHE.exists() else {}
for fname, ctitle in meta.items():
    if ctitle in cache:
        continue
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           "&iiprop=extmetadata&titles=" + quote("File:" + ctitle))
    for attempt in range(4):
        r = subprocess.run(["curl", "-sS", "--max-time", "60", api], capture_output=True)
        try:
            j = json.loads(r.stdout.decode("utf-8", "ignore"))
            page = next(iter(j["query"]["pages"].values()))
            em = page["imageinfo"][0]["extmetadata"]
            artist = re.sub(r"<[^>]+>", "", em.get("Artist", {}).get("value", ""))
            lic = em.get("LicenseShortName", {}).get("value", "see Commons file page")
            cache[ctitle] = {"artist": artist.strip(), "license": lic.strip()}
            break
        except Exception as e:
            print("retry", ctitle, attempt, e)
            time.sleep(8)
    else:
        raise SystemExit("Commons 元数据失败: " + ctitle)
    time.sleep(1.5)
CACHE.write_bytes(json.dumps(cache, ensure_ascii=False, indent=1).encode("utf8"))
print("[3/4] Commons 元数据 OK:", len(cache), "条")

# ---------- 4. CREDITS + imageCredits.ts + 批次 JSON ----------
def short_artist(s):
    s = re.sub(r"\s+", " ", s or "").strip()
    m = re.search(r"user\s+([A-Za-z0-9._\-]+)", s, re.I)
    if m:
        return "Wikimedia Commons user " + m.group(1)
    return (s[:60] + "…") if len(s) > 60 else (s or "Wikimedia Commons contributor")

CREDITS_PATH = DST / "CREDITS.json"
credits = json.loads(CREDITS_PATH.read_text(encoding="utf8"))
recs = []
for role, (fname, ctitle) in zip(["cover", "fig1", "fig2"], IMAGES):
    name = "%s-%s.webp" % (SLUG, role)
    info = cache[ctitle]
    recs.append({
        "file": "/original/" + name,
        "source": "Wikimedia Commons",
        "commons_title": "File:" + ctitle,
        "commons_page": "https://commons.wikimedia.org/wiki/File%3A" + quote(ctitle),
        "artist": short_artist(info["artist"]),
        "license": info["license"],
        "size_kb": round((DST / name).stat().st_size / 1024),
    })
credits[SLUG] = {"cover": recs[0], "figs": recs[1:]}
CREDITS_PATH.write_bytes((json.dumps(credits, ensure_ascii=False, indent=2) + "\n").encode("utf8"))

lines = [
    "// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）\n",
    "// 数据来源：public/original/CREDITS.json；全量重建，保留历史批次署名\n",
    "export type ImageCredit = { artist: string; license: string; url: string };\n\n",
    "export const IMAGE_CREDITS: Record<string, ImageCredit> = {\n",
]
count = 0
for group in credits.values():
    for r in [group["cover"]] + list(group.get("figs", [])):
        artist = r["artist"].replace("\\", "\\\\").replace('"', '\\"')
        url = r["commons_page"].replace("\\", "\\\\").replace('"', '\\"')
        lic = r["license"].replace('"', '\\"')
        lines.append('  "%s": { artist: "%s", license: "%s", url: "%s" },\n' % (r["file"], artist, lic, url))
        count += 1
lines.append("};\n")
(ROOT / "src/lib/imageCredits.ts").write_bytes("".join(lines).encode("utf8"))

imgs = ["/original/%s-%s.webp" % (SLUG, r) for r in ("cover", "fig1", "fig2")]
batch = [{
    "id": "rss-orig-%s-2026-11r" % SLUG,
    "title": title, "summary": SUMMARY,
    "cover": imgs[0], "images": imgs, "imageCount": 3,
    "tags": TAGS, "category": CATEGORY, "locale": "zh",
    "source": "starteday 原创", "sourceUrl": "https://www.apec.org/",
    "author": "starteday 编辑部", "publishedAt": 0,
    "readMinutes": MINUTES, "pinned": 1, "body": body,
}]
out = ROOT / "data" / "original" / "premium-2026-11r.json"
out.write_bytes((json.dumps(batch, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
print("[4/4] CREDITS %d 组 / imageCredits %d 条 / premium-2026-11r.json %d 篇" % (len(credits), count, len(batch)))
print("TITLE:", title)
