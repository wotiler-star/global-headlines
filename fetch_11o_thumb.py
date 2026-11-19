# -*- coding: utf-8 -*-
"""fetch_11o_thumb.py — 用 thumb 缩略图通道下载 11o 候选（原图 URL 被 429，thumb 通道 200）。
1280px 宽足够裁 1200x800。逐张落盘元数据，防中断丢失。
"""
import json, subprocess, time
from pathlib import Path

ROOT = Path('.')
SRC = ROOT / 'brand_real_11o'; SRC.mkdir(exist_ok=True)
PICKS = json.loads((ROOT / 'commons_picks_11o.json').read_text(encoding='utf8'))
META = json.loads((ROOT / 'downloads_11o.json').read_text(encoding='utf8')) if (ROOT / 'downloads_11o.json').exists() else {}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAGIC = {b'\xff\xd8\xff': '.jpg', b'\x89PNG\r\n\x1a\n': '.png', b'RIFF': '.webp'}
PER_GROUP = 6

def flush_meta():
    (ROOT / 'downloads_11o.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')

def ext_of(d):
    for m, e in MAGIC.items():
        if d.startswith(m):
            return e
    return None

def thumb_url(original, width=1280):
    """把原图 URL 转成 thumb URL。"""
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
            print("skip exists", base, flush=True)
            got += 1
            # 补元数据
            mapping[existing[0].name] = mapping.get(existing[0].name) or ({k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item} | {'commons_page': item.get('page','')})
            flush_meta()
            continue
        url = thumb_url(item.get('url', ''))
        if not url:
            print("no url", base, flush=True)
            continue
        ok = False
        for attempt in range(3):
            tmp = SRC / (base + '.tmp')
            r = subprocess.run(["curl", "-sSL", "-A", UA, "--max-time", "40", "-o", str(tmp), "-w", "%{http_code}", url], capture_output=True)
            code = r.stdout.decode(errors='replace').strip()
            data = tmp.read_bytes() if tmp.exists() else b''
            e = ext_of(data[:16])
            if e and len(data) > 20000:
                out = SRC / (base + e)
                out.write_bytes(data)
                tmp.unlink(missing_ok=True)
                rec = {k: item[k] for k in ('title','w','h','license','artist','page','url') if k in item}
                rec['commons_page'] = item.get('page', '')
                rec['thumb_w'] = 1280
                mapping[out.name] = rec
                print("ok", base, len(data)//1024, "KB", "|", item['title'][:44], flush=True)
                flush_meta()
                ok = True
                got += 1
                break
            tmp.unlink(missing_ok=True)
            print("retry", base, "code", code, "bytes", len(data), flush=True)
            time.sleep(8)
        if not ok:
            print("FAIL", base, flush=True)
        time.sleep(2)
    print(f"[{group}] got {got}", flush=True)

print("DONE files", len([p for p in SRC.glob('*.*') if not p.name.endswith('.tmp')]), "meta", len(mapping), flush=True)
