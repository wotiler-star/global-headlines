# -*- coding: utf-8 -*-
"""fetch_11o_slow.py — 尊重 Commons retry-after(120s) 的慢速下载。
原图/thumb 通道都试；429 时等 125s 重试，成功等 12s。逐张落盘元数据。每主题只需 5 张。
"""
import json, subprocess, time, urllib.parse
from pathlib import Path

ROOT = Path('.')
SRC = ROOT / 'brand_real_11o'; SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / 'commons_picks_11o.json').read_text(encoding='utf8'))
META = json.loads((ROOT / 'downloads_11o.json').read_text(encoding='utf8')) if (ROOT / 'downloads_11o.json').exists() else {}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAGIC = {b'\xff\xd8\xff': '.jpg', b'\x89PNG\r\n\x1a\n': '.png', b'RIFF': '.webp'}
PER_GROUP = 5

def flush_meta():
    (ROOT / 'downloads_11o.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')

def ext_of(d):
    for m, e in MAGIC.items():
        if d.startswith(m):
            return e
    return None

def thumb_url(original, width=1280):
    u = original.split('?')[0]
    marker = '/wikipedia/commons/'
    if marker not in u:
        return None
    head, path = u.split(marker, 1)
    fn = path.split('/')[-1]
    return head + marker + 'thumb/' + path + f'/{width}px-' + fn

mapping = dict(META)
for group, items in PICKS.items():
    got = 0
    for n, item in enumerate(items[:PER_GROUP], 1):
        base = "%s-%02d" % (group, n)
        existing = [p for p in SRC.glob(base + ".*") if not p.name.endswith('.tmp')]
        if existing:
            print("skip", base, flush=True)
            mapping[existing[0].name] = mapping.get(existing[0].name) or ({k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item} | {'commons_page': item.get('page','')})
            flush_meta(); got += 1
            continue
        if got >= PER_GROUP:
            break
        urls = [thumb_url(item.get('url','')), item.get('url','').split('?')[0]]
        urls = [u for u in urls if u]
        ok = False
        for attempt in range(6):
            url = urls[attempt % len(urls)]
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
                print("ok", base, len(data)//1024, "KB", "|", item['title'][:42], flush=True)
                flush_meta(); ok = True; got += 1
                break
            tmp.unlink(missing_ok=True)
            wait = 125 if code == '429' else 20
            print("retry", base, code, "wait", wait, flush=True)
            time.sleep(wait)
        if not ok:
            print("FAIL", base, flush=True)
        time.sleep(12)
    print(f"[{group}] got {got}/{PER_GROUP}", flush=True)

print("DONE files", len([p for p in SRC.glob('*.*') if not p.name.endswith('.tmp')]), "meta", len(mapping), flush=True)
