# -*- coding: utf-8 -*-
"""快速补下 11m 剩余候选图（复用已下4张），短间隔+快速失败跳过。"""
import json, subprocess, time, urllib.parse, os
from pathlib import Path
ROOT=Path('.')
SRC=ROOT/'brand_real_11m'; SRC.mkdir(exist_ok=True)
PICKS=json.loads((ROOT/'commons_picks_11m.json').read_text(encoding='utf8'))
WANT=json.loads((ROOT/'picks_11m.json').read_text(encoding='utf8'))
META=json.loads((ROOT/'downloads_11m.json').read_text(encoding='utf8')) if (ROOT/'downloads_11m.json').exists() else {}
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAGIC={b'\xff\xd8\xff':'.jpg', b'\x89PNG\r\n\x1a\n':'.png', b'RIFF':'.webp'}
def ext_of(d):
    for m,e in MAGIC.items():
        if d.startswith(m): return e
    return None

mapping=dict(META)
for group,titles in WANT.items():
    for i,title in enumerate(titles,1):
        base="%s-%02d"%(group,i)
        # 跳过已落盘
        existing=list(SRC.glob(base+".*"))
        if existing and not any(p.name.endswith('.tmp') for p in existing):
            print("skip exists",base,flush=True); continue
        item=next((x for x in PICKS.get(group,[]) if x['title']==title),None)
        if not item: print("no meta",base,flush=True); continue
        url="https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(title.replace(" ","_"),safe="")+"?width=2000"
        ok=False
        for attempt in range(3):
            tmp=SRC/(base+'.tmp')
            r=subprocess.run(["curl","-sSL","-A",UA,"--max-time","55","-o",str(tmp),"-w","%{http_code}",url],capture_output=True)
            code=r.stdout.decode().strip()
            data=tmp.read_bytes() if tmp.exists() else b''
            e=ext_of(data[:16])
            if e and len(data)>20000:
                out=SRC/(base+e); out.write_bytes(data); tmp.unlink(missing_ok=True)
                rec={k:item[k] for k in ('title','w','h','license','artist','page','url') if k in item}
                rec['commons_page']=item.get('page','')
                mapping[out.name]=rec
                print("ok",base,len(data)//1024,"KB",flush=True); ok=True; break
            tmp.unlink(missing_ok=True)
            print("retry",base,"code",code,"bytes",len(data),flush=True)
            time.sleep(15)
        if not ok: print("FAIL",base,flush=True)
        time.sleep(6)
(ROOT/'downloads_11m.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2),encoding='utf8')
print("DONE total",len(list(SRC.glob('*.*'))),"files, meta",len(mapping),flush=True)
