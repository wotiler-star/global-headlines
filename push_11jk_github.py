# -*- coding: utf-8 -*-
# push 11j + 11k batch files to GitHub (whitelist flat-tree patch)
# base = remote tip tree; only listed paths are overwritten, everything else preserved.
import json, base64, hashlib, os, re, sys, time
import urllib.request

REPO = "wotiler-star/global-headlines"
API = "https://api.github.com/repos/" + REPO
TOKEN = open("C:/Users/Administrator/.workbuddy/gh_pat.txt").read().strip()

def api(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + url, data=data, method=method,
        headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            if e.code == 422:
                raise RuntimeError("422 (not fast-forward?): " + body)
            if attempt == 2:
                raise
            time.sleep(3)

def blob_sha(p):
    data = open(p, "rb").read()
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data)); h.update(data)
    return h.hexdigest()

# --- 1. whitelist ---
EXCLUDE = {"downloads_11j.json", "src_for_11k.json"}  # intermediates, keep repo clean
cands = []
for f in sorted(os.listdir("data/original")):
    if re.search(r"2026-11[jk]", f):
        cands.append("data/original/" + f)
for f in sorted(os.listdir("public/original")):
    if f.endswith(".webp") and re.search(
        r"china-ai-export|china-games-export|china-webnovel|memristor|lipid|hotel", f):
        cands.append("public/original/" + f)
cands += ["public/original/CREDITS.json", "src/lib/imageCredits.ts", "prepare_cov48.py"]
for f in sorted(os.listdir(".")):
    if re.search(r"11j|11k|image_quality_gate", f) and f.endswith((".py", ".mjs", ".js", ".json")) \
       and f not in EXCLUDE:
        cands.append(f)

remote = {}
tree = api("GET", "/git/trees/main?recursive=1")
for t in tree["tree"]:
    if t["type"] == "blob":
        remote[t["path"]] = t["sha"]
assert not tree.get("truncated")

ADD = []
for p in sorted(set(cands)):
    if not os.path.exists(p):
        print("SKIP missing:", p); continue
    if remote.get(p) != blob_sha(p):
        ADD.append(p)
print("to push:", len(ADD), "files")
for p in ADD: print("  ", p)

# --- 2. upload blobs ---
entries = []
for p in ADD:
    data = open(p, "rb").read()
    b = api("POST", "/git/blobs", {"content": base64.b64encode(data).decode(), "encoding": "base64"})
    entries.append({"path": p.replace("\\", "/"), "mode": "100644", "type": "blob", "sha": b["sha"]})
    print("blob ok:", p)

# --- 3. commit ---
tip = api("GET", "/commits/main")   # tree nested under "commit"
base_tree = tip["commit"]["tree"]["sha"]
parent = tip["sha"]
new_tree = api("POST", "/git/trees", {"base_tree": base_tree, "tree": entries})
assert new_tree["sha"] != base_tree, "tree unchanged?"
commit = api("POST", "/git/commits", {
    "message": "feat(editorial): 2026-11j + 2026-11k 批次——6 主题 × 8 语种 48 稿 + 18 图 + CREDITS/imageCredits 重建 + 门禁与管线脚本",
    "tree": new_tree["sha"], "parents": [parent]})
api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"], "force": False})
print("COMMIT:", commit["sha"])

# --- 4. verify ---
final = api("GET", "/commits/main")
print("TIP:", final["sha"])
print("TREE_MATCH:", final["commit"]["tree"]["sha"] == new_tree["sha"])
chk = api("GET", "/git/trees/" + final["tree"]["sha"] + "?recursive=1")
rmap = {t["path"]: t["sha"] for t in chk["tree"] if t["type"] == "blob"}
bad = [p for p in ADD if rmap.get(p.replace("\\", "/")) != blob_sha(p)]
print("PATHS_VERIFIED:", len(ADD) - len(bad), "/", len(ADD), " mismatches:", bad)
sys.exit(1 if bad else 0)
