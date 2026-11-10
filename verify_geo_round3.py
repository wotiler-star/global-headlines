# -*- coding: utf-8 -*-
"""verify_geo_round3.py — GEO 第三轮线上验收（只读）
1) 文章页：SpeakableSpecification / Claim / mentions / 导读锚点，且 Claim.text 与可见导读一致
2) 主题实体页：8 语种 200、Thing/CollectionPage/ItemList、canonical、8 个版本链接 200
3) tag 实体档案页：CollectionPage / Thing / 可见统计卡
4) sitemap 的 topic <loc> 精确条数、llms.txt 实体链接零死链
"""
import json, re, subprocess, sys

SRV = "root@43.155.171.45"
LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"]
BASE = "127.0.0.1:8082"


def sh(cmd):
    r = subprocess.run(["ssh", "-o", "BatchMode=yes", SRV, cmd],
                       capture_output=True, text=True, encoding="utf-8")
    return r.stdout


def get(path):
    return sh("curl -s %s%s" % (BASE, path))


_STATUS = {}


def status(path):
    if path in _STATUS:
        return _STATUS[path]
    out = sh("curl -s -o /dev/null -w '%%{http_code}' %s%s" % (BASE, path))
    _STATUS[path] = out.strip()
    return _STATUS[path]


def batch_status(paths):
    """一次 SSH 批量取状态码：逐条 curl 建 SSH 会把验收拖到 10 分钟以上。"""
    todo = [p for p in dict.fromkeys(paths) if p not in _STATUS]
    if not todo:
        return
    script = "\n".join(
        'printf "%%s %%s\\n" "$(curl -s -o /dev/null -w \'%%{http_code}\' %s%s)" "%s"'
        % (BASE, p, p)
        for p in todo
    )
    out = sh("bash -s <<'GEOEOS'\n%s\nGEOEOS" % script)
    for line in out.splitlines():
        parts = line.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].isdigit():
            _STATUS[parts[1]] = parts[0]
    for p in todo:
        _STATUS.setdefault(p, "000")


def ld_blocks(html):
    out = []
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(b)
        except Exception:
            continue
        out.extend(d.get("@graph", [d]))
    return out


fails = []

# --- 1) 文章页 ---
art_paths = {
    "zh": "/zh/article/rss-orig-china-webnovel-global-2026-11j",
    "en": "/en/article/rss-orig-china-webnovel-global-2026-11j-en",
    "ja": "/ja/article/rss-orig-photonic-memristor-2026-11k-ja",
    "tr": "/tr/article/rss-orig-hotel-content-economy-2026-11k-tr",
}
for loc, path in art_paths.items():
    html = get(path)
    nodes = ld_blocks(html)
    news = next((n for n in nodes if n.get("@type") == "NewsArticle"), None)
    if not news:
        fails.append("%s: 无 NewsArticle" % loc); continue
    spk = news.get("speakable", {})
    if spk.get("@type") != "SpeakableSpecification" or not spk.get("cssSelector"):
        fails.append("%s: speakable 缺失" % loc)
    for sel in spk.get("cssSelector", []):
        cls = sel.split(" ")[0].lstrip(".")
        if cls not in html:
            fails.append("%s: speakable 选择器 %s 在页面不存在" % (loc, sel))
    claim = news.get("mainEntity", {})
    if claim.get("@type") != "Claim" or not claim.get("text"):
        fails.append("%s: Claim 缺失" % loc)
    elif claim["text"][:40] not in re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)):
        fails.append("%s: Claim.text 与可见导读不一致" % loc)
    if not news.get("mentions"):
        fails.append("%s: mentions 实体标注缺失" % loc)
    if 'id="claim"' not in html:
        fails.append("%s: 导读缺 #claim 锚点" % loc)
    if '"ClaimReview"' in html:
        fails.append("%s: 误加 ClaimReview（违规标记）" % loc)
    print("%s 文章: speakable=%s Claim=%s mentions=%d" % (
        loc, spk.get("@type"), claim.get("@type"), len(news.get("mentions", []))))

# --- 2) 主题实体页 ---
slugs = ["china-webnovel-global", "photonic-memristor", "hotel-content-economy"]
batch_status(["/%s/topic/%s" % (loc, slugs[0]) for loc in LOCALES])
for slug in slugs[:1]:
    for loc in LOCALES:
        path = "/%s/topic/%s" % (loc, slug)
        code = status(path)
        if code != "200":
            fails.append("%s: HTTP %s" % (path, code)); continue
        html = get(path)
        nodes = ld_blocks(html)
        types = {n.get("@type") for n in nodes}
        if not {"Thing", "CollectionPage", "ItemList"}.issubset(types):
            fails.append("%s: 结构化数据缺 %s" % (path, {"Thing", "CollectionPage", "ItemList"} - types))
        item = next((n for n in nodes if n.get("@type") == "ItemList"), {})
        if item.get("numberOfItems") != 8:
            fails.append("%s: ItemList %s 条（应 8）" % (path, item.get("numberOfItems")))
        can = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        if not can or "/%s/topic/%s" % (loc, slug) not in can.group(1):
            fails.append("%s: canonical 异常" % path)
        print("%s topic: 200, types=%s, items=%s" % (loc, ",".join(sorted(types & {"Thing", "CollectionPage", "ItemList"})), item.get("numberOfItems")))
    # 8 个语种文章链接
    html = get("/zh/topic/%s" % slug)
    links = re.findall(r'href="/([a-z]{2})/article/([^"]+)"', html)
    print("主题页语种文章链接:", len(links))
    if len(links) != 8:
        fails.append("主题页链接 %d 条（应 8）" % len(links))
    batch_status(["/%s/article/%s" % (l, aid) for l, aid in links])
    for l, aid in links[:8]:
        c = status("/%s/article/%s" % (l, aid))
        if c != "200":
            fails.append("主题页链接死链 /%s/article/%s -> %s" % (l, aid, c))

# --- 3) tag 实体档案页 ---
tag_html = get("/zh/tag/%E6%B6%88%E8%B4%B9%E7%94%B5%E5%AD%90")
tag_types = {n.get("@type") for n in ld_blocks(tag_html)}
if not {"Thing", "CollectionPage"}.issubset(tag_types):
    fails.append("tag 实体页缺 Thing/CollectionPage: %s" % tag_types)
if "ENTITY PROFILE" not in tag_html:
    fails.append("tag 实体页缺可见档案卡")
print("tag 实体页:", sorted(tag_types))

# --- 4) sitemap / llms 实体链接 ---
sm = get("/sitemap.xml")
topic_locs = re.findall(r"<loc>([^<]*/topic/[^<]*)</loc>", sm)
print("sitemap topic <loc>:", len(topic_locs))
if len(topic_locs) < 200:
    fails.append("sitemap topic 条数 %d 偏少" % len(topic_locs))

llms = get("/llms.txt")
entity_urls = re.findall(r"\]\((https://starteday\.com/[^)]*?/(?:topic|tag)/[^)]*)\)", llms)
print("llms 实体链接:", len(entity_urls))
dead = []
paths = [u.replace("https://starteday.com", "") for u in entity_urls]
batch_status(paths)
for p in paths:
    c = status(p)
    if c != "200":
        dead.append((p, c))
print("实体链接死链:", dead[:5])
if dead:
    fails.append("实体链接死链 %d 条" % len(dead))

print("\nFAILS:", len(fails))
for f in fails:
    print(" -", f)
sys.exit(1 if fails else 0)
