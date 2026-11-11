# -*- coding: utf-8 -*-
import json, subprocess, urllib.request, re, sys

# 取 rss-orig 稿件 id（服务器端 docker 内）
ids = subprocess.check_output(
    ["docker", "exec", "global-headlines", "node", "-e",
     'console.log(JSON.stringify(require("/app/data/articles.json")'
     '.filter(x=>x.id.startsWith("rss-orig-")).map(x=>x.id).slice(0,10)))']
).decode().strip()
ids = json.loads(ids)
base = "http://127.0.0.1:8082"
total_links = 0
dead = []
max_links = 0
for i in ids:
    try:
        html = urllib.request.urlopen(base + "/zh/article/" + i, timeout=20).read().decode("utf-8", "ignore")
    except Exception as e:
        print("ERR", i, e); continue
    links = re.findall(r'class="art-entity-link"[^>]*href="([^"]*)"', html)
    total_links += len(links)
    max_links = max(max_links, len(links))
    status = "OK" if len(links) <= 3 else "OVER3"
    print(f"{i:55s} links={len(links)} {status}")
    for h in links:
        try:
            r = urllib.request.urlopen(base + h, timeout=20)
            if r.status != 200:
                dead.append((i, h, r.status))
        except Exception as e:
            dead.append((i, h, str(e)[:50]))
print(f"\nTOTAL_LINKS={total_links} MAX_PER_ARTICLE={max_links} DEAD={len(dead)}")
for d in dead:
    print("  DEAD", d)
sys.exit(1 if dead or max_links > 3 else 0)
