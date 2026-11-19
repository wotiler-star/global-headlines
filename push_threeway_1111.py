# -*- coding: utf-8 -*-
"""三方对齐补推: 把「服务器==本地、GitHub 落后」的文件推到 GitHub。
白名单 = _push_list_1111.txt (由 threeway_detail.py 的分组生成)。
base_tree 差分, 只覆盖列出的路径, 其余远端内容保持不变。
文本按 LF 归一, 二进制原样, 避免 Windows CRLF 假差异被推上远端。
"""
import base64, hashlib, json, os, time, urllib.error, urllib.request

REPO = "wotiler-star/global-headlines"
API = "https://api.github.com/repos/" + REPO
TOKEN = open("C:/Users/Administrator/.gh_pat").read().strip()   # 实测 push=True
HEADERS = {"Authorization": "token " + TOKEN,
           "Accept": "application/vnd.github+json",
           "User-Agent": "starteday-editorial/1.0"}

BINARY_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2",
              ".ttf", ".otf", ".pdf", ".gz", ".tgz", ".zip", ".sqlite", ".db")


def content(p):
    d = open(p, "rb").read()
    if not p.lower().endswith(BINARY_EXT):
        d = d.replace(b"\r\n", b"\n")
    return d


def blob_sha(d):
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(d))
    h.update(d)
    return h.hexdigest()


def api(method, url, payload=None, retries=5):
    data = json.dumps(payload).encode() if payload is not None else None
    for attempt in range(retries):
        req = urllib.request.Request(API + url, data=data, method=method, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            if e.code in (400, 401, 403, 404, 422):
                raise RuntimeError(f"HTTP {e.code} {method} {url}: {body}")
            if attempt == retries - 1:
                raise
            print(f"  retry {method} {url} HTTP {e.code} ({attempt+1}/{retries})")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt == retries - 1:
                raise
            print(f"  retry {method} {url} {type(e).__name__} ({attempt+1}/{retries})")
        time.sleep(3 * (attempt + 1))


def main():
    paths = [l.strip() for l in open("_push_list_1111.txt", encoding="utf-8") if l.strip()]
    assert paths, "empty whitelist"
    missing = [p for p in paths if not os.path.isfile(p)]
    assert not missing, f"missing local files: {missing}"

    tip = api("GET", "/commits/main")
    old_tip = tip["sha"]
    base_tree = tip["commit"]["tree"]["sha"]
    print("OLD_TIP:", old_tip[:10], "| base_tree:", base_tree[:10])

    t = api("GET", "/git/trees/" + base_tree + "?recursive=1")
    assert not t.get("truncated"), "remote tree truncated"
    remote = {x["path"]: x["sha"] for x in t["tree"] if x["type"] == "blob"}

    add = [p for p in paths if remote.get(p) != blob_sha(content(p))]
    print("清单", len(paths), "个 | 实际需推", len(add), "个")
    if not add:
        print("远端已是最新, 无需推送")
        return 0

    entries = []
    for i, p in enumerate(add, 1):
        d = content(p)
        want = blob_sha(d)
        b = api("POST", "/git/blobs", {"content": base64.b64encode(d).decode(), "encoding": "base64"})
        assert b["sha"] == want, f"blob sha mismatch {p}"
        entries.append({"path": p.replace("\\", "/"), "mode": "100644", "type": "blob", "sha": b["sha"]})
        if i % 20 == 0 or i == len(add):
            print(f"  blob {i}/{len(add)}")

    new_tree = api("POST", "/git/trees", {"base_tree": base_tree, "tree": entries})
    assert new_tree["sha"] != base_tree, "tree unchanged"
    commit = api("POST", "/git/commits", {
        "message": "chore(sync): 三方对齐——补推服务器/本地已有的 11l 批次与图片等 124 文件（GitHub 落后），prepare_cov48 以本地为准",
        "tree": new_tree["sha"], "parents": [old_tip]})
    api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"], "force": False})
    print("NEW_TIP:", commit["sha"][:10])

    final = api("GET", "/commits/main")
    chk = api("GET", "/git/trees/" + final["commit"]["tree"]["sha"] + "?recursive=1")
    rmap = {x["path"]: x["sha"] for x in chk["tree"] if x["type"] == "blob"}
    bad = [p for p in add if rmap.get(p) != blob_sha(content(p))]
    print("TREE_MATCH:", final["commit"]["tree"]["sha"] == new_tree["sha"])
    print("PATHS_VERIFIED:", len(add) - len(bad), "/", len(add), "mismatches:", bad[:10])
    return 0 if not bad else 1


if __name__ == "__main__":
    raise SystemExit(main())
