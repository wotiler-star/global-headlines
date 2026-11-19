# -*- coding: utf-8 -*-
"""fetch_11o_final.py — 只用 Special:FilePath 通道补齐缺图主题（该通道实测 200）。"""
import json, subprocess, time, urllib.parse
from pathlib import Path

ROOT = Path('.')
SRC = ROOT / 'brand_real_11o'; SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / 'commons_picks_11o.json').read_text(encoding='utf8'))
META = json.loads((ROOT / 'downloads_11o.json').read_text(encoding='utf8')) if (ROOT / 'downloads_11o.json').exists() else {}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAGIC = {b'\xff\xd8\xff': '.jpg', b'\x89PNG\r\n\x1a\n': '.png', b'RIFF': '.webp'}
# 只补缺图的主题，目标数量
NEED = {"crossborder-decade": 5, "smart-port": 5, "oem-to-brand": 5}

def flush_meta():
    (ROOT / 'downloads_11o.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')

def ext_of(d):
    for m, e in MAGIC.items():
        if d.startswith(m):
            return e
    return None

def filepath_url(title, width=1280):
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(title.replace(" ", "_"), safe="") + f"?width={width}"

mapping = dict(META)
for group, target in NEED.items():
    items = PICKS.get(group, [])
    have = len([p for p in SRC.glob(group + "-*.*") if not p.name.endswith('.tmp')])
    print(f"[{group}] 现有 {have}, 目标 {target}", flush=True)
    n = 1
    tries = 0
    while have < target and n <= len(items) and tries < 25:
        base = "%s-%02d" % (group, n)
        existing = [p for p in SRC.glob(base + ".*") if not p.name.endswith('.tmp')]
        if existing:
            mapping[existing[0].name] = mapping.get(existing[0].name) or ({k: items[n-1][k] for k in ('title','w','h','license','artist','page','url') if k in items[n-1]} | {'commons_page': items[n-1].get('page','')})
            flush_meta(); n += 1; continue
        item = items[n-1]
        url = filepath_url(item['title'])
        tmp = SRC / (base + '.tmp')
        r = subprocess.run(["curl","-sSL","-A",UA,"--max-time","50","-o",str(tmp),"-w","%{http_code}",url], capture_output=True)
        code = r.stdout.decode(errors='replace').strip()
        data = tmp.read_bytes() if tmp.exists() else b''
        e = ext_of(data[:16])
        if e and len(data) > 20000:
            out = SRC / (base + e)
            out.write_bytes(data); tmp.unlink(missing_ok=True)
            rec = {k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item}
            rec['commons_page'] = item.get('page','')
            mapping[out.name] = rec
            print("ok", base, len(data)//1024, "KB", "|", item['title'][:40], flush=True)
            flush_meta(); have += 1; tries = 0
        else:
            tmp.unlink(missing_ok=True)
            print("retry", base, code, "bytes", len(data), flush=True)
            tries += 1
        n += 1
        time.sleep(4)
    print(f"[{group}] done have={have}", flush=True)

print("DONE files", len([p for p in SRC.glob('*.*') if not p.name.endswith('.tmp')]), "meta", len(mapping), flush=True)
