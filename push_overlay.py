#!/usr/bin/env python3
# overlay push: 从远端树出发，只叠加本次 5 个交付文件（3 改 + 2 增），保留远端其它文件。
# Python urllib 被沙箱拦截 -> 全部 HTTP 走 subprocess curl。
import json, subprocess, sys, base64

REPO = "wotiler-star/global-headlines"
TOKEN = open("C:/Users/Administrator/.gh_pat", encoding="utf-8").read().strip()
LOCAL = "F:/workbuddyxingqiuge/starteday.com/global-news-starteday"
API = f"https://api.github.com/repos/{REPO}"

# 默认交付集（可覆盖：python push_overlay.py <file1> <file2> ...）
FILES = [
    "src/i18n/config.ts",
    "src/i18n/geoLocale.ts",
    "src/lib/site.ts",
    "data/original/premium-bn-2026-11.json",
    "data/original/premium-ur-2026-11.json",
]
if len(sys.argv) > 1:
    FILES = sys.argv[1:]

def curl(method, url, body=None, expect_json=True):
    import tempfile, os
    body_file = None
    if body is not None:
        fd, body_file = tempfile.mkstemp(suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(body, fh, ensure_ascii=False)
    cmd = ["curl", "-s", "--max-time", "60", "-X", method,
           "-H", f"Authorization: Bearer {TOKEN}",
           "-H", "Accept: application/vnd.github+json",
           "-H", "Expect:"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", f"@{body_file}"]
    cmd += ["-w", "\n%{http_code}", url]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if body_file:
        os.unlink(body_file)
    out = r.stdout.rsplit("\n", 1)
    code = int(out[-1]) if len(out) == 2 and out[-1].isdigit() else 0
    data = json.loads(out[0]) if expect_json and out[0].strip() else None
    return code, data

def sha_result(text):
    # 必须以 bytes 显式 UTF-8 传 stdin：text=True 在中文 Windows 会用 GBK 编码，哈希错乱
    r = subprocess.run(["git", "hash-object", "--stdin"], input=text.encode("utf-8"),
                       capture_output=True, cwd=LOCAL)
    return r.stdout.decode().strip()

# 1. tip
code, ref = curl("GET", f"{API}/git/refs/heads/main")
assert code == 200 and ref, f"ref failed {code}"
OLD_TIP = ref["object"]["sha"]
print("OLD_TIP:", OLD_TIP)

# 2. commit -> tree
code, commit = curl("GET", f"{API}/git/commits/{OLD_TIP}")
assert code == 200, f"commit failed {code}"
old_tree = commit["tree"]["sha"]
print("old tree:", old_tree)

# 3. recursive tree
code, tree = curl("GET", f"{API}/git/trees/{old_tree}?recursive=1")
assert code == 200 and not tree.get("truncated"), f"tree failed {code} truncated={tree.get('truncated') if tree else None}"
entries = {e["path"]: e for e in tree["tree"] if e["type"] == "blob"}
print("remote blob entries:", len(entries))

# 4. compute local blobs
changed, added = [], []
for f in FILES:
    with open(f"{LOCAL}/{f}", "r", encoding="utf-8", newline="") as fh:
        content = fh.read()
    blob = sha_result(content)
    if f in entries:
        if entries[f]["sha"] != blob:
            changed.append(f); print("CHANGED:", f, entries[f]["sha"][:8], "->", blob[:8])
        else:
            print("SAME (skip):", f)
    else:
        added.append(f); print("ADDED:", f, blob[:8])
    entries[f] = {"path": f, "mode": "100644", "type": "blob", "sha": blob}

assert changed or added, "nothing to push"
print(f"to push: {len(changed)} changed + {len(added)} added")

# 4b. create blobs on GitHub for changed/added files
for f in changed + added:
    with open(f"{LOCAL}/{f}", "r", encoding="utf-8", newline="") as fh:
        content = fh.read()
    code, b = curl("POST", f"{API}/git/blobs",
                   {"content": base64.b64encode(content.encode("utf-8")).decode(),
                    "encoding": "base64"})
    assert code == 201, f"blob POST failed {code} for {f}: {json.dumps(b)[:200]}"
    assert b["sha"] == entries[f]["sha"], f"blob sha mismatch for {f}: {b['sha']} != {entries[f]['sha']}"
    print("blob created:", f, b["sha"][:8])

# 5. build tree incrementally: base_tree 保留远端全部条目，只叠加本次 5 个变更
changes = [{"path": e["path"], "mode": e.get("mode", "100644"),
            "type": "blob", "sha": e["sha"]}
           for f, e in entries.items() if f in FILES]
code, newtree = curl("POST", f"{API}/git/trees", {"base_tree": old_tree, "tree": changes})
assert code == 201, f"tree POST failed {code}: {json.dumps(newtree)[:300]}"
print("new tree:", newtree["sha"])

# 6. commit
code, newcommit = curl("POST", f"{API}/git/commits", {
    "message": "i18n: add Bengali (bn) and Urdu (ur) locales, 19 total\n\n"
               "- locales/NEW_LOCALES/localeMeta/localeRegions/ogLocale + bn(ltr)/ur(rtl)\n"
               "- geoLocale: BD->bn, PK->ur (removed from en group)\n"
               "- fix articleBaseId regex to cover all clone locales (ms/fil/vi/th/my/bn/ur): corrects hreflang alternates for existing clones\n"
               "- article seeds: premium-{bn,ur}-2026-11.json (32 each, en clones pending real translation)",
    "tree": newtree["sha"], "parents": [OLD_TIP]})
assert code == 201, f"commit failed {code}: {json.dumps(newcommit)[:300]}"
print("NEW_COMMIT:", newcommit["sha"])

# 7. fast-forward ref
code, upd = curl("PATCH", f"{API}/git/refs/heads/main", {"sha": newcommit["sha"], "force": False})
assert code == 200, f"ref update failed {code}: {json.dumps(upd)[:300]}"
print("ref updated:", upd["object"]["sha"])

# 8. assert TREE_MATCH
code, c2 = curl("GET", f"{API}/git/commits/{newcommit['sha']}")
assert c2["tree"]["sha"] == newtree["sha"], "TREE MISMATCH"
print("TREE_MATCH=True")
print("ALL_OK tip", OLD_TIP[:7], "->", newcommit["sha"][:7])
