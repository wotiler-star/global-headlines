# -*- coding: utf-8 -*-
"""fetch_11o.py — 下载 11o 五主题的 Commons 候选原图（每主题前 N 张）供目检。
带 UA、逐张间隔、魔法字节校验、>20KB 过滤、429 短退避。元数据写 downloads_11o.json。
"""
import json, subprocess, time, urllib.parse
from pathlib import Path

ROOT = Path('.')
SRC = ROOT / 'brand_real_11o'; SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / 'commons_picks_11o.json').read_text(encoding='utf8'))
META = json.loads((ROOT / 'downloads_11o.json').read_text(encoding='utf8')) if (ROOT / 'downloads_11o.json').exists() else {}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAGIC = {b'\xff\xd8\xff': '.jpg', b'\x89PNG\r\n\x1a\n': '.png', b'RIFF': '.webp'}
# 每主题下载前 N 张候选（每篇只需 3 张，下 5 张供挑选+冗余）
PER_GROUP = 5

def flush_meta():
    (ROOT / 'downloads_11o.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')

def ext_of(d):
    for m, e in MAGIC.items():
        if d.startswith(m):
            return e
    return None

mapping = dict(META)
for group, items in PICKS.items():
    for n, item in enumerate(items[:PER_GROUP], 1):
        base = "%s-%02d" % (group, n)
        existing = [p for p in SRC.glob(base + ".*") if not p.name.endswith('.tmp')]
        if existing:
            mapping[existing[0].name] = {k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item} | {'commons_page': item.get('page','')}
            print("skip exists", base, flush=True)
            flush_meta()
            continue
        title = item['title']
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(title.replace(" ", "_"), safe="") + "?width=2000"
        ok = False
        for attempt in range(3):
            tmp = SRC / (base + '.tmp')
            r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "55", "-o", str(tmp), "-w", "%{http_code}", url], capture_output=True)
            code = r.stdout.decode(errors='replace').strip()
            data = tmp.read_bytes() if tmp.exists() else b''
            e = ext_of(data[:16])
            if e and len(data) > 20000:
                out = SRC / (base + e)
                out.write_bytes(data)
                tmp.unlink(missing_ok=True)
                rec = {k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item}
                rec['commons_page'] = item.get('page', '')
                mapping[out.name] = rec
                print("ok", base, len(data)//1024, "KB", "|", title[:48], flush=True)
                flush_meta()
                ok = True
                break
            tmp.unlink(missing_ok=True)
            print("retry", base, "code", code, "bytes", len(data), flush=True)
            time.sleep(15)
        if not ok:
            print("FAIL", base, flush=True)
        time.sleep(6)

(ROOT / 'downloads_11o.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')
print("DONE files", len([p for p in SRC.glob('*.*') if not p.name.endswith('.tmp')]), "meta", len(mapping), flush=True)
