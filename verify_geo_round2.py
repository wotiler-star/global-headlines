# -*- coding: utf-8 -*-
import json, re, subprocess, sys

SRV = "root@43.155.171.45"
LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"]

def srv(cmd):
    r = subprocess.run(["ssh", "-o", "BatchMode=yes", SRV, cmd],
                       capture_output=True, text=True, encoding="utf-8")
    return r.stdout

fails = []
for loc in LOCALES:
    html = srv("curl -s 127.0.0.1:8082/%s/about" % loc)
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    faq = None
    for b in blocks:
        try:
            d = json.loads(b)
        except Exception:
            continue
        for node in d.get("@graph", []):
            if node.get("@type") == "FAQPage":
                faq = node
    if not faq:
        fails.append("%s: 无 FAQPage JSON-LD" % loc); continue
    qs = faq.get("mainEntity", [])
    if len(qs) != 5:
        fails.append("%s: FAQ %d 问（应 5）" % (loc, len(qs)))
    visible = re.sub(r"<[^>]+>", " ", html)
    visible = re.sub(r"\s+", " ", visible)
    for q in qs:
        question = q["name"]
        answer = q["acceptedAnswer"]["text"]
        if question not in visible:
            fails.append("%s: 问题未在页面可见: %s" % (loc, question[:30]))
        if answer[:40] not in visible:
            fails.append("%s: 答案未在页面可见: %s" % (loc, answer[:30]))
    # 品牌拼写合规
    if re.search(r"starteda(?!y)", html):
        fails.append("%s: 品牌错拼 starteda" % loc)
    if loc == "ko" and "时也" in html:
        fails.append("ko: 混入汉字「时也」")
    print("%s: %d 问，问答均可见，inLanguage=%s" % (loc, len(qs), faq.get("inLanguage")))

# llms-full 分组条数
full = srv("curl -s 127.0.0.1:8082/llms-full.txt")
groups = re.findall(r"^### (\w+)（(\d+) 篇）", full, re.M)
print("llms-full 分组:", groups)
urls = re.findall(r"\]\((https://starteday\.com/[^)]+)\)", full)
bad_urls = [u for u in urls if not re.match(r"https://starteday\.com/[a-z]{2}/article/", u)]
print("llms-full 绝对链接:", len(urls), "异常:", len(bad_urls))
if bad_urls: fails.append("llms-full 异常链接 %d" % len(bad_urls))
if len(urls) != 233: fails.append("llms-full 条目数 %d != 233" % len(urls))

# llms.txt 必须有全量索引链接与站点事实
llms = srv("curl -s 127.0.0.1:8082/llms.txt")
for key in ["llms-full.txt", "站点事实", "引用格式", "CC BY"]:
    if key not in llms: fails.append("llms.txt 缺 %s" % key)

# robots 显式 AI UA 与 /api/ 限制
rob = srv("curl -s 127.0.0.1:8082/robots.txt")
for ua in ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot", "User-Agent: *"]:
    if ua not in rob: fails.append("robots 缺 %s" % ua)
if rob.count("Disallow: /api/") < 2:
    fails.append("robots /api/ 限制未覆盖 AI UA 段")

print("\nFAILS:", len(fails))
for f in fails: print(" -", f)
sys.exit(1 if fails else 0)
