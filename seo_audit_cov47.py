# -*- coding: utf-8 -*-
"""seo_audit_cov47.py — 在服务器本机运行，抓取实际 SSR HTML 做 Google 收录审计。
用法：scp 到服务器后 `python3 /tmp/seo_audit_cov47.py`
"""
import json
import re
import urllib.request

BASE = "http://127.0.0.1:8082"
PATHS = [
    "/zh", "/en", "/ja",
    "/zh?cat=tech", "/zh?cat=world",
    "/zh/article/rss-orig-spatial-glasses-2026-11",
    "/zh/article/rss-orig-edge-ai-chip-2026-11",
    "/zh/search?q=AI", "/zh/login", "/zh/register",
    "/zh/write", "/zh/admin", "/zh/me",
]


def fetch(path):
    try:
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "SEO-Audit/1.0"})
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode("utf8", "replace")
    except Exception as e:
        return 0, str(e)


def one(m, s, flags=0):
    x = re.search(m, s, flags)
    return x.group(1).strip() if x else None


def analyze(path):
    code, s = fetch(path)
    if not code:
        return {"path": path, "error": s[:120]}
    ld = []
    for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
        try:
            j = json.loads(block)
            nodes = j.get("@graph", [j]) if isinstance(j, dict) else j
            ld.extend([n.get("@type") for n in nodes if isinstance(n, dict) and n.get("@type")])
        except Exception:
            ld.append("PARSE_ERROR")
    imgs = re.findall(r"<img\b[^>]*>", s, re.I)
    no_alt = [i for i in imgs if not re.search(r"\balt=", i, re.I)]
    links = re.findall(r'<a\b[^>]*href="(/[^"#?]*)', s, re.I)
    return {
        "path": path,
        "http": code,
        "bytes": len(s),
        "title": one(r"<title>(.*?)</title>", s, re.S),
        "desc": one(r'<meta[^>]*name="description"[^>]*content="([^"]*)"', s)
                or one(r'<meta[^>]*content="([^"]*)"[^>]*name="description"', s),
        "robots": one(r'<meta[^>]*name="robots"[^>]*content="([^"]*)"', s)
                  or one(r'<meta[^>]*content="([^"]*)"[^>]*name="robots"', s),
        "canonical": one(r'<link[^>]*rel="canonical"[^>]*href="([^"]*)"', s)
                     or one(r'<link[^>]*href="([^"]*)"[^>]*rel="canonical"', s),
        # Next 15 输出 hrefLang（驼峰），HTML 属性名大小写不敏感，审计必须忽略大小写
        "hreflang": len(re.findall(r'rel="alternate"[^>]*hreflang=', s, re.I)),
        "x_default": bool(re.search(r'hreflang="x-default"', s, re.I)),
        "og_type": one(r'<meta[^>]*property="og:type"[^>]*content="([^"]*)"', s),
        "og_image": one(r'<meta[^>]*property="og:image"[^>]*content="([^"]*)"', s),
        "twitter_card": one(r'<meta[^>]*name="twitter:card"[^>]*content="([^"]*)"', s),
        "gsc_meta": 'google-site-verification' in s,
        "h1": len(re.findall(r"<h1\b", s, re.I)),
        "h2": len(re.findall(r"<h2\b", s, re.I)),
        "internal_links": len(links),
        "article_links": len([l for l in links if "/article/" in l]),
        "imgs": len(imgs),
        "imgs_no_alt": len(no_alt),
        "jsonld": ld,
    }


if __name__ == "__main__":
    out = [analyze(p) for p in PATHS]
    code, robots = fetch("/robots.txt")
    code2, sitemap = fetch("/sitemap.xml")
    print(json.dumps({
        "pages": out,
        "robots_txt": robots[:600],
        "sitemap": {"http": code2, "urls": sitemap.count("<loc>"), "bytes": len(sitemap)},
    }, ensure_ascii=False, indent=2))
