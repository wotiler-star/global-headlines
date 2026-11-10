# -*- coding: utf-8 -*-
"""比对 GitHub 远端 tree 与本地文件，确认本次外链优化的改动范围"""
import hashlib
import json
import urllib.request
from pathlib import Path

PAT = Path("C:/Users/Administrator/.workbuddy/gh_pat.txt").read_text(encoding="utf8").strip()
HDR = {"Authorization": "Bearer " + PAT, "User-Agent": "WorkBuddy"}
REPO = "https://api.github.com/repos/wotiler-star/global-headlines"


def api(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=HDR), timeout=40) as r:
        return json.loads(r.read())


ref = api(REPO + "/git/ref/heads/main")
tip = ref["object"]["sha"]
tree = api(REPO + "/git/commits/" + tip)["tree"]["sha"]
t = api(REPO + "/git/trees/" + tree + "?recursive=1")
remote = {e["path"]: e["sha"] for e in t["tree"] if e["type"] == "blob"}
print("remote tip", tip[:12], "tree", tree[:12], "blobs", len(remote))

files = [
    "scripts/gen-rss.mjs",
    "src/app/[locale]/layout.tsx",
    "src/app/globals.css",
    "src/app/sitemap.ts",
    "src/lib/seoTools.ts",
    "src/app/[locale]/article/[id]/page.tsx",
]
for f in files:
    data = Path(f).read_bytes()
    lsha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    rsha = remote.get(f)
    print("%-52s remote=%-12s local=%-12s %s" % (
        f, str(rsha)[:10], lsha[:10], "SAME" if rsha == lsha else "DIFF"))

print("\n远端已有的 about/atom 相关路径:", [p for p in remote if "about" in p or "atom" in p][:8])
print("远端是否含 11j 稿件:", any("2026-11j" in p for p in remote))
