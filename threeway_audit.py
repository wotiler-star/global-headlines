# -*- coding: utf-8 -*-
"""threeway_audit.py — starteday 三方一致性只读体检（服务器 / GitHub / 本地）

用法：在 global-news-starteday 根目录跑 python threeway_audit.py
输出：server!=github / github!=local 差异清单 + ALIGNED 断言。
只读，不修改任何文件；发现差异先人工判方向，服务器为唯一真相源。
"""
import base64, hashlib, json, os, subprocess, urllib.request

REPO = "wotiler-star/global-headlines"
API = "https://api.github.com/repos/" + REPO
SRV = "root@43.155.171.45"
TOKEN = open("C:/Users/Administrator/.workbuddy/gh_pat.txt").read().strip()
UA = {"User-Agent": "starteday-editorial/1.0 (contact: admin@starteday.com)"}


def blob_sha_bytes(d):
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(d)); h.update(d)
    return h.hexdigest()


def api(url):
    r = urllib.request.Request(url, headers={"Authorization": "token " + TOKEN,
                                             "Accept": "application/vnd.github+json"})
    return json.load(urllib.request.urlopen(r))


def server_shas():
    code = r"""
import os,hashlib
skip=('./node_modules','./.next','./.git','./staging','./brand_real','./brand_real2','./brand_real_11j')
for root,dirs,files in os.walk('.'):
    dirs[:]=[d for d in dirs if os.path.join(root,d) not in skip and not d.startswith('.')]
    for f in files:
        if '.bak' in f or f.endswith(('.log','.pyc','.tgz')): continue
        p=os.path.join(root,f)[2:]
        try: dd=open(p,'rb').read()
        except: continue
        h=hashlib.sha1(); h.update(b'blob '+str(len(dd)).encode()+b'\0'); h.update(dd)
        print(h.hexdigest(), p)
"""
    cmd = ["ssh", "-o", "BatchMode=yes", SRV,
           "cd /root/global-news-starteday && python3 -"]  # 脚本走 stdin，避免 shell 引号/换行转义
    out = subprocess.run(cmd, input=code, capture_output=True, text=True, encoding="utf-8")
    if out.returncode:
        raise RuntimeError("server scan failed: " + (out.stderr or "")[:300])
    shas = {}
    for line in out.stdout.splitlines():
        if " " in line:
            s, p = line.split(" ", 1)
            shas[p] = s
    return shas


def main():
    tip = api(API + "/commits/main")
    print("GitHub tip :", tip["sha"][:10], "|", tip["commit"]["message"].splitlines()[0][:60])
    tree = api(API + "/git/trees/" + tip["commit"]["tree"]["sha"] + "?recursive=1")
    assert not tree.get("truncated"), "GitHub tree truncated"
    gh = {t["path"]: t["sha"] for t in tree["tree"] if t["type"] == "blob"}

    srv = server_shas()
    loc = {p: blob_sha_bytes(open(p, "rb").read()) for p in gh if os.path.isfile(p)}

    sg = [p for p in sorted(srv) if gh.get(p) != srv[p]]
    gl = [p for p in sorted(gh) if loc.get(p) != gh[p]]
    sl = [p for p in sorted(srv) if p in loc and loc[p] != srv[p]]
    print("server %d / github %d / local %d" % (len(srv), len(gh), len(loc)))
    print("server != github : %d" % len(sg)); [print("   ", p) for p in sg[:20]]
    print("github != local  : %d" % len(gl)); [print("   ", p) for p in gl[:20]]
    print("server != local  : %d" % len(sl)); [print("   ", p) for p in sl[:20]]
    aligned = not (sg or gl or sl)
    print("ALIGNED:", aligned)
    if gl:
        print("提示：若差异文件仅差 CRLF（本地多 \\r），属 Windows core.autocrlf 假差异，")
        print("      用 open(f,'rb').read().replace(b'\\r\\n',b'\\n') 归一化即可，勿推远端。")
    return 0 if aligned else 2


if __name__ == "__main__":
    raise SystemExit(main())
