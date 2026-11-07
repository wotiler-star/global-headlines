# -*- coding: utf-8 -*-
"""seo_audit_cov61.py — starteday.com 多搜索引擎收录与原创文章 SEO 体检"""
import json
import re
import subprocess
from collections import Counter

D = "https://starteday.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def get(path, ua=None):
    r = subprocess.run(["curl", "-sSL", "-A", ua or UA, "--max-time", "45", D + path], capture_output=True)
    return r.stdout.decode("utf8", "replace")


out = {}
robots = get("/robots.txt")
out["robots"] = robots.strip()
out["robots_has_sitemap"] = bool(re.search(r"Sitemap:", robots, re.I))
out["robots_disallow"] = re.findall(r"Disallow:\s*(\S+)", robots)

sm = get("/sitemap.xml")
urls = re.findall(r"<loc>(.*?)</loc>", sm)
out["sitemap_urls"] = len(urls)
out["sitemap_locales"] = Counter(re.match(r"https?://[^/]+/([a-z]{2})/", u).group(1) for u in urls if re.match(r"https?://[^/]+/([a-z]{2})/", u))
out["sitemap_articles"] = len([u for u in urls if "/article/" in u])
out["sitemap_www"] = len([u for u in urls if "://www." in u])
out["sitemap_lastmod"] = len(re.findall(r"<lastmod>", sm))

art_path = "/zh/article/rss-orig-cold-atoms-2026-11"
html = get(art_path)


def meta(name):
    m = re.search(r'<meta[^>]+(?:name|property)=["\']%s["\'][^>]*content=["\'](.*?)["\']' % re.escape(name), html, re.I)
    if not m:
        m = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]*(?:name|property)=["\']%s["\']' % re.escape(name), html, re.I)
    return m.group(1) if m else None


out["article"] = {
    "title": (re.search(r"<title>(.*?)</title>", html, re.S) or [None, ""])[1][:90],
    "description": (meta("description") or "")[:120],
    "robots": meta("robots"),
    "canonical": (re.search(r'<link[^>]+rel="canonical"[^>]+href="(.*?)"', html) or [None, None])[1],
    "hreflang_count": len(re.findall(r"href[Ll]ang=", html)),
    "x_default": 'hreflang="x-default"' in html or "hrefLang=\"x-default\"" in html,
    "og_image": meta("og:image"),
    "og_type": meta("og:type"),
    "article_published": meta("article:published_time"),
    "article_section": meta("article:section"),
    "twitter_card": meta("twitter:card"),
    "google_verification": (meta("google-site-verification") or "")[:20],
    "bing_verification": meta("msvalidate.01"),
    "yandex_verification": meta("yandex-verification"),
    "baidu_verification": meta("baidu-site-verification"),
    "ld_json_count": len(re.findall(r'application/ld\+json', html)),
    "body_in_ssr": "9.7 皮开尔文" in html,
    "credits_in_ssr": "IMAGE CREDITS" in html,
    "img_alt_count": len(re.findall(r'<img[^>]+alt="[^"]{4,}"', html)),
}
lds = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S)
parsed = []
for raw in lds:
    try:
        obj = json.loads(raw)
        parsed.append(obj)
    except Exception:
        parsed.append({"parse_error": raw[:80]})
out["ld_types"] = [o.get("@type") for o in parsed if isinstance(o, dict)]
for o in parsed:
    if isinstance(o, dict) and o.get("@type") == "NewsArticle":
        out["news_article_fields"] = {
            "has_headline": "headline" in o,
            "has_image": "image" in o,
            "image_absolute": str(o.get("image", "")).startswith("http"),
            "has_datePublished": "datePublished" in o,
            "has_dateModified": "dateModified" in o,
            "has_author": "author" in o,
            "has_publisher": "publisher" in o,
            "has_inLanguage": "inLanguage" in o,
            "has_articleSection": "articleSection" in o,
            "has_wordCount": "wordCount" in o,
            "has_mainEntityOfPage": "mainEntityOfPage" in o,
            "has_isAccessibleForFree": "isAccessibleForFree" in o,
            "has_description": "description" in o,
        }

# 各爬虫 UA 是否拿到同等内容（防 UA 屏蔽 / cloaking）
bots = {
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Baiduspider": "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "YandexBot": "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "DuckDuckBot": "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
}
out["bots"] = {}
for name, ua in bots.items():
    h = get(art_path, ua)
    out["bots"][name] = {"bytes": len(h), "body_in_html": "9.7 皮开尔文" in h, "status_200_hint": "<title>" in h}

# 首页 SSR 是否含文章链接
home = get("/zh")
out["home_article_links_ssr"] = len(re.findall(r'href="[^"]*/article/[^"]+"', home))
out["home_rss_link"] = bool(re.search(r'rel="alternate"[^>]+rss', home))

print(json.dumps(out, ensure_ascii=False, indent=2))
