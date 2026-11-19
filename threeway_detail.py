# -*- coding: utf-8 -*-
"""threeway_detail.py — 三方差异详细诊断(只读)。
对内容做 CRLF->LF 归一化后比较 blob sha, 区分「真差异」与 Windows 假差异,
并列出每个差异文件在 server/github/local 各自的存在性与哈希。
"""
import hashlib, json, os, subprocess, urllib.request

REPO = "wotiler-star/global-headlines"
API = "https://api.github.com/repos/" + REPO
SRV = "root@43.155.171.45"
TOKEN = open("C:/Users/Administrator/.workbuddy/gh_pat.txt").read().strip()


def blob_sha(d):
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(d))
    h.update(d)
    return h.hexdigest()


BINARY_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2",
              ".ttf", ".otf", ".pdf", ".gz", ".tgz", ".zip", ".sqlite", ".db")


def norm(p, d):
    # 二进制文件不能做 CRLF 归一: 图片字节里恰好含 \r\n 会被改坏, 产生大量假差异
    return d if p.lower().endswith(BINARY_EXT) else d.replace(b"\r\n", b"\n")


def api(url):
    r = urllib.request.Request(url, headers={"Authorization": "token " + TOKEN,
                                             "Accept": "application/vnd.github+json",
                                             "User-Agent": "starteday-editorial/1.0"})
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
        BIN=('.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.pdf','.gz','.tgz','.zip','.sqlite','.db')
        if not p.lower().endswith(BIN): dd=dd.replace(b'\r\n',b'\n')
        h=hashlib.sha1(); h.update(b'blob '+str(len(dd)).encode()+b'\0'); h.update(dd)
        print(h.hexdigest(), p)
"""
    out = subprocess.run(["ssh", "-o", "BatchMode=yes", SRV,
                          "cd /root/global-news-starteday && python3 -"],
                         input=code, capture_output=True, text=True, encoding="utf-8")
    if out.returncode:
        raise RuntimeError("server scan failed: " + (out.stderr or "")[:300])
    return {p: s for s, p in (l.split(" ", 1) for l in out.stdout.splitlines() if " " in l)}


def main():
    tip = api(API + "/commits/main")
    print("GitHub tip:", tip["sha"][:10], "|", tip["commit"]["message"].splitlines()[0][:70])
    tree = api(API + "/git/trees/" + tip["commit"]["tree"]["sha"] + "?recursive=1")
    assert not tree.get("truncated"), "GitHub tree truncated"
    gh = {t["path"]: t["sha"] for t in tree["tree"] if t["type"] == "blob"}
    srv = server_shas()
    loc = {}
    for p in gh:
        if os.path.isfile(p):
            loc[p] = blob_sha(norm(p, open(p, "rb").read()))

    allp = sorted(set(gh) | set(srv) | set(loc))
    diffs = [p for p in allp if not (gh.get(p) == srv.get(p) == loc.get(p))]
    print(f"\n归一化后: server {len(srv)} / github {len(gh)} / local {len(loc)} / 差异 {len(diffs)}")

    cat = {"server_only": [], "local_only": [], "github_only": [],
           "gh_behind": [], "loc_diff": [], "srv_behind": [], "all_diff": []}
    for p in diffs:
        g, s, l = gh.get(p), srv.get(p), loc.get(p)
        row = f"  {p:<62} GH={str(g)[:8]:<9} SRV={str(s)[:8]:<9} LOC={str(l)[:8]:<9}"
        if g is None and s is not None and l is None: cat["server_only"].append(row)
        elif l is not None and g is None and s is None: cat["local_only"].append(row)
        elif g is not None and s is None and l is None: cat["github_only"].append(row)
        elif s is not None and l is not None and s == l and g != s: cat["gh_behind"].append(row)
        elif g is not None and s is not None and g == s and l != g: cat["loc_diff"].append(row)
        elif g is not None and l is not None and g == l and s != g: cat["srv_behind"].append(row)
        else: cat["all_diff"].append(row)

    for k, title in [("server_only", "服务器独有 -> 拉回本地 + 推 GitHub"),
                     ("gh_behind", "GitHub 落后(SRV==LOC!=GH) -> 推 GitHub"),
                     ("loc_diff", "本地独有改动(GH==SRV!=LOC) -> 需定方向"),
                     ("srv_behind", "服务器落后(GH==LOC!=SRV) -> 推服务器"),
                     ("all_diff", "三方各不相同"),
                     ("local_only", "本地独有"), ("github_only", "GitHub 独有")]:
        print(f"\n=== {title}: {len(cat[k])} ===")
        print("\n".join(cat[k][:60]) or "  (无)")
        if len(cat[k]) > 60: print(f"  ... 还有 {len(cat[k])-60} 个")

    # 落一份完整分组(不受屏幕打印上限影响), 供推送清单使用
    with open("_threeway_groups.json", "w", encoding="utf-8") as f:
        json.dump({k: [r.strip().split()[0] for r in v] for k, v in cat.items()}, f, indent=1)

    print("\nALIGNED(NORM):", not diffs)
    return 0 if not diffs else 2


if __name__ == "__main__":
    raise SystemExit(main())
