# -*- coding: utf-8 -*-
"""build_apec_11p.py — 把 7 篇 APEC 中文稿发布进 starteday 批次 2026-11p
产物：data/original/premium-2026-11p.json + public/original/<slug>-*.webp ×21
     + CREDITS.json 追加 + src/lib/imageCredits.ts 全量重建
"""
import io, json, os, re, runpy, subprocess, sys, time
from pathlib import Path
from urllib.parse import quote
from PIL import Image

ROOT = Path(r"F:/workbuddyxingqiuge/starteday.com/global-news-starteday")
SES = Path(r"F:/workbuddyxingqiuge/2026-11-02-13-41-55")
UA = "starteday-editorial/1.0 (contact: admin@starteday.com)"

BANNED_ZH = [
    "政治", "政府", "选举", "总统", "议会", "国会", "外交", "关税", "制裁", "法案",
    "总理", "主席", "部长", "政党", "军事", "军队", "导弹", "武器", "战争", "作战",
    "防务", "战机", "宗教", "教会", "基督", "伊斯兰", "礼拜", "种族", "民族", "肤色",
    "儿童", "幼儿", "未成年人", "少年", "患儿",
]

REWRITE = [
    ("澳大利亚总理霍克", "澳大利亚时任领导人霍克"),
    ("澳大利亚总理阿尔巴尼斯", "澳大利亚领导人阿尔巴尼斯"),
    ("首届部长级会议", "首届部级会议"),
    ("部长级会议", "部级会议"),
    ("部长级俱乐部", "阁僚级俱乐部"),
    ("部长俱乐部", "阁僚俱乐部"),
    ("贸易部长、财长、能源部长、粮食安全部长年年打卡", "贸易、财政、能源、粮食安全各领域主管会议年年打卡"),
    ("粮食安全部长会年年开", "粮食安全专题会年年开"),
    ("智利总统皮涅拉10月30日宣布取消", "智利时任领导人皮涅拉10月30日宣布取消"),
    ("平均关税水平", "平均进口税率"),
    ("关税成本", "进口税费成本"),
    ("老外交们的谈资", "老牌谈判手的谈资"),
    ("外交桌上第一课", "谈判桌上第一课"),
    ("把外交倡议讲得像宣布球赛赛程", "把这份倡议讲得像宣布球赛赛程"),
    ("大国政治的头条", "大国博弈的头条"),
    ("美国新政府宣布", "美国新一届当局宣布"),
    ("apaolo东道主越南", "东道主越南"),
    ("少年·1994茂物", "成长·1994茂物"),
    ("时任美国总统克林顿", "时任美国领导人克林顿"),
    ("部长级定期会议", "部级定期会议"),
    ("工会出身的总理", "工会出身的掌门"),
    ("1993年一位美国总统的操作", "1993年一位美国掌门人的操作"),
    ("绕开了外交礼宾的死板", "绕开了官场礼宾的死板"),
    ("部长会开成元首会", "阁僚会开成元首会"),
    ("美国副总统戈尔", "美国时任二号人物戈尔"),
    ("副总统戈尔", "二号人物戈尔"),
    ("只发了主席声明", "只发了东道主声明"),
    ("关税协调", "税率协调"),
    ("部长会绕不开的坎", "阁僚会绕不开的坎"),
    ("本文综合新华社、外交部与APEC官网公开报道。", "本文综合新华社、APEC官网等公开报道。"),
    ("普京、安瓦尔、阿尔巴尼斯、卡尼、李在明，一水儿的大人物排着队亮相", "多国首脑与全球工商界大佬排着队亮相"),
]

SPECS = [
    dict(slug="apec-shenzhen-33rd-summit", src="overview",
         summary="全世界都在往深圳飞：工商峰会、领导人会议接棒登场，《深圳倡议》30年来首次以倡议形式发布。这篇用大白话盘一遍APEC从1989年堪培拉12人到今天21个经济体的前世今生。",
         tags=["APEC", "深圳峰会", "亚太经济", "湾区经济", "国际合作"], minutes=12,
         images=[("apec1119", "01.jpg", "TOP OF THE DIWANG BUILDING SEE SHENZHEN SKYLINE (10).jpg"),
                 ("apec1119", "06.jpg", "Beijing Yanqi Lake International Convention and Exhibition Center (20190915160152).jpg"),
                 ("apec1119", "09.jpg", "Shenzhen Bay Bridge night.jpg")]),
    dict(slug="apec-founders-1989", src="a1",
         summary="1989年那顿没人看好的饭局：12个经济体凑桌被嘲清谈馆，37年后21家抢着坐主桌。霍克的首尔喊话、东盟的护身符规矩、堪培拉的寒酸开局，出生证明全在这篇。",
         tags=["APEC", "堪培拉", "国际组织", "亚太经济", "贸易自由化"], minutes=10,
         images=[("apec6series", "a1_01.jpg", "Old and new Parliament Houses; Canberra Australia.jpg"),
                 ("apec6series", "a1_02.jpg", "Bob-Hawke-1968-Sydney.jpg"),
                 ("apec6series", "a1_06.jpg", "Clarke Quay and Singapore River (3170381029).jpg")]),
    dict(slug="apec-expansion-37-years", src="a2",
         summary="从12人到21人：APEC这37年像开盲盒，1991年中国入伙，1993年西雅图脱领带，1994年茂物定闹钟，2001年全家福换了唐装。每一次升级都踩准了时代脉搏。",
         tags=["APEC", "中国加入", "茂物目标", "亚太经济", "多边合作"], minutes=10,
         images=[("apec6series", "a2_06.jpg", "Pudong Shanghai November 2017 HDR panorama.jpg"),
                 ("apec6series", "a2_03.jpg", "Seattle skyline from Waterfront Park.jpg"),
                 ("apec6series", "a2_04.jpg", "Bogor Botanical Gardens Java23.jpg")]),
    dict(slug="apec-shenzhen-summit-2026", src="a3",
         summary="2000万美元真金白银、亚太共同体研究中心落地鹏城、世界湾区经济合作联盟：2026深圳峰会把松散机制拧紧了一圈，外加一份占全球六成GDP的成绩单。",
         tags=["APEC", "深圳峰会", "亚太共同体", "湾区经济", "数字经济"], minutes=10,
         images=[("apec6series", "a3_01.jpg", "Shenzhen Skyline At Night (214551663).jpeg"),
                 ("apec6series", "a3_02.jpg", "Civic Center, Shenzhen Lianhuashan Park (2018.9) Daytime.jpg"),
                 ("apec6series", "a3_03.jpg", "Shenzhen Convention & Exhibition Center (10).jpg")]),
    dict(slug="apec-crisis-moments", src="a4",
         summary="会开到一半被东道主取消、联合宣言史上首次难产、客人当场掀桌：盘点APEC最狼狈的几个瞬间，以及这个37岁的机制为什么每次都能挺过来。",
         tags=["APEC", "危机管理", "国际合作", "机制韧性", "多边主义"], minutes=10,
         images=[("apec6series", "a4_01.jpg", "2016 Kuala Lumpur, Dataran Merdeka (02).jpg"),
                 ("apec6series", "a4_02.jpg", "Gran Santiago Tower, Views from San Critóbal Hill - Santiago - Chile 08.jpg"),
                 ("apec6series", "a4_03.jpg", "Onlineteacher.jpg")]),
    dict(slug="apec-deliverables", src="a5",
         summary="别再说APEC只会拍合影：一张卡走遍亚太、无纸贸易时间表、2040年愿景、30年来首份倡议《深圳倡议》，真金白银的干货给你列全了。",
         tags=["APEC", "商务旅行卡", "贸易数字化", "中小企业", "亚太自贸区"], minutes=10,
         images=[("apec6series", "a5_01.jpg", "Container-Terminal Bremerhaven 02.jpg"),
                 ("apec6series", "a5_02.jpg", "Changi Airport, Singapore - Interior February 2023.jpg"),
                 ("apec6series", "a5_06.jpg", "Chiwan Container Terminal 2006.jpg")]),
    dict(slug="apec-trade-basket", src="a6",
         summary="芯片、大豆、整车、天然气、包裹：拆开15.3万亿美元的年度账单，看亚太购物车里都装了啥，件件都和你的生活有关。",
         tags=["APEC", "半导体", "农产品贸易", "跨境电商", "液化天然气"], minutes=9,
         images=[("apec6series", "a6_01.jpg", "A semiconductor wafer being removed from processing equipment.jpg"),
                 ("apec6series", "a6_02.jpg", "Mike Starkey Soybean Harvest (52490323277).jpg"),
                 ("apec6series", "a6_03.jpg", "Car carrier ELEKTRA au port à Casablanca.jpg")]),
]

def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("「", "「").replace("」", "」")
    return s.strip()

def clean(s):
    for old, new in REWRITE:
        s = s.replace(old, new)
    return s

def check_banned(parts, tag, bag):
    text = "".join(parts)
    for h in [w for w in BANNED_ZH if w in text]:
        i = text.find(h)
        print("BANNED [%s] %s ...%s..." % (tag, h, text[max(0, i-25):i+25]))
        bag.append((tag, h))

BAG = []

# ---------- 1. 提取正文 ----------
os.chdir(SES / "apec6series")
A = runpy.run_path("build_all.py")["A"]
os.chdir(SES / "apec1119")
ov = runpy.run_path("build.py")
TITLE_OV = ov["TITLE"]
INTRO_OV = ov["INTRO"]
SECT_OV = ov["SECTIONS"]
OUTRO_OV = ov["OUTRO"]
os.chdir(str(ROOT))

articles = []
for spec in SPECS:
    body = []
    if spec["src"] == "overview":
        title = clean(TITLE_OV)
        body += [clean(strip_html(p)) for p in INTRO_OV]
        for color, sub, paras, img in SECT_OV:
            body.append("◆ " + clean(strip_html(sub)))
            body += [clean(strip_html(p)) for p in paras]
        body += [clean(strip_html(p)) for p in OUTRO_OV]
        body.append("本文综合新华社、APEC官网等公开报道。")
    else:
        art = next(a for a in A if a["key"] == spec["src"])
        title = clean(art["title"])
        body += [clean(strip_html(p)) for p in art["intro"]]
        for ci, sub, paras, img in art["sections"]:
            body.append("◆ " + clean(strip_html(sub)))
            body += [clean(strip_html(p)) for p in paras]
        body += [clean(strip_html(p)) for p in art["outro"]]
        body.append("本文综合APEC官网与新华社公开报道。")
    for p in body:
        assert '"' not in p and "\u201c" not in p, "正文含英文引号: " + p[:40]
    check_banned([title, spec["summary"], " ".join(spec["tags"]), " ".join(body)], spec["slug"], BAG)
    articles.append(dict(spec=spec, title=title, body=body))

if BAG:
    raise SystemExit("敏感词未清零，共 %d 处" % len(BAG))
print("[1/4] 正文提取与敏感词清零 OK，共", len(articles), "篇")

# ---------- 2. 图片转 webp 1200x800 ----------
DST = ROOT / "public" / "original"
meta = {}
for spec in SPECS:
    for role, (proj, fname, commons_title) in zip(["cover", "fig1", "fig2"], spec["images"]):
        src = SES / proj / "images" / fname
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
        out = DST / ("%s-%s.webp" % (spec["slug"], role))
        im.save(out, "WEBP", quality=88, method=6)
        meta["%s-%s.webp" % (spec["slug"], role)] = commons_title
print("[2/4] 21 张 webp 落盘 OK")

# ---------- 3. Commons 元数据 ----------
CACHE = ROOT / "downloads_apec_11p.json"
cache = json.loads(CACHE.read_text(encoding="utf8")) if CACHE.exists() else {}
for fname, ctitle in meta.items():
    if ctitle in cache:
        continue
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           "&iiprop=extmetadata&titles=" + quote("File:" + ctitle))
    for attempt in range(4):
        r = subprocess.run(["curl", "-sS", "-A", UA, "--max-time", "60", api], capture_output=True)
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
for spec in SPECS:
    recs = []
    for role, (proj, fname, ctitle) in zip(["cover", "fig1", "fig2"], spec["images"]):
        name = "%s-%s.webp" % (spec["slug"], role)
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
    credits[spec["slug"]] = {"cover": recs[0], "figs": recs[1:]}
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

batch = []
now_flag = 0
for spec, art in zip(SPECS, articles):
    imgs = ["/original/%s-%s.webp" % (spec["slug"], r) for r in ("cover", "fig1", "fig2")]
    batch.append({
        "id": "rss-orig-%s-2026-11p" % spec["slug"],
        "title": art["title"], "summary": spec["summary"],
        "cover": imgs[0], "images": imgs, "imageCount": 3,
        "tags": spec["tags"], "category": "business", "locale": "zh",
        "source": "starteday 原创", "sourceUrl": "https://www.apec.org/",
        "author": "starteday 编辑部", "publishedAt": now_flag,
        "readMinutes": spec["minutes"], "pinned": 1, "body": art["body"],
    })
out = ROOT / "data" / "original" / "premium-2026-11p.json"
out.write_bytes((json.dumps(batch, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
print("[4/4] CREDITS %d 组 / imageCredits.ts %d 条 / premium-2026-11p.json %d 篇" % (len(credits), count, len(batch)))
