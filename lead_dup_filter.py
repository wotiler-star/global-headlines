# -*- coding: utf-8 -*-
"""
lead_dup_filter.py — 「导读 == 正文」低质量文章判定（分析 / 删除共用同一口径）

数据事实（src/app/[locale]/article/[id]/page.tsx）：
  LEAD 区块渲染 article.summary；正文渲染 article.body（字符串数组，RichBlock 逐段）。
  因此「导读内容与正文内容完全一样」= normalize(summary) == normalize(拼接后的全部正文)。
归一化：去 HTML 标签、反转义、去所有空白与常见中英文标点、转小写，避免排版差异误判。
"""
import html
import json
import re

TAG = re.compile(r"<[^>]+>")
PUNCT = re.compile(
    r"[\s\u3000，。！？、；：,.!?;:（）()\[\]【】\"\u201c\u201d\u2018\u2019"
    r"《》<>「」·—…\-/|]+"
)


def normalize(s):
    s = html.unescape(TAG.sub("", str(s or "")))
    return PUNCT.sub("", s).lower()


def body_text(a):
    b = a.get("body") or []
    if isinstance(b, str):
        b = [b]
    return "".join(str(x) for x in b)


def is_lead_duplicate(a):
    """严格口径：整篇正文（去标签/标点后）与导读完全相同。"""
    sm = normalize(a.get("summary"))
    full = normalize(body_text(a))
    return bool(sm) and bool(full) and sm == full


def is_near_duplicate(a):
    """宽松口径：正文以导读开头，且额外内容不足 20 个字符（用于对照统计，不用于删除）。"""
    sm = normalize(a.get("summary"))
    full = normalize(body_text(a))
    if not sm or not full or sm == full:
        return False
    return full.startswith(sm) and len(full) - len(sm) < 20


def load(path):
    with open(path, encoding="utf8") as f:
        return json.load(f)


def report(data, label):
    hits = [a for a in data if is_lead_duplicate(a)]
    near = [a for a in data if is_near_duplicate(a)]
    print(f"[{label}] 总数={len(data)} 严格命中={len(hits)} ({len(hits)/max(1,len(data)):.1%}) 近似={len(near)}")
    loc_all, loc_hit = {}, {}
    for a in data:
        loc_all[a.get("locale")] = loc_all.get(a.get("locale"), 0) + 1
    for a in hits:
        loc_hit[a.get("locale")] = loc_hit.get(a.get("locale"), 0) + 1
    print("  语种分布 (命中/总数):")
    for l in sorted(loc_all, key=lambda x: str(x)):
        print(f"    {l}: {loc_hit.get(l,0)}/{loc_all[l]}  剩余 {loc_all[l]-loc_hit.get(l,0)}")
    src = {}
    for a in hits:
        src[a.get("source")] = src.get(a.get("source"), 0) + 1
    print("  命中来源 top10:", sorted(src.items(), key=lambda x: -x[1])[:10])
    print("  样本:")
    for a in hits[:5]:
        print(f"    {a.get('id')} [{a.get('locale')}] {str(a.get('title'))[:48]} | {str(a.get('summary'))[:80]}")
    return hits


if __name__ == "__main__":
    import sys
    for p in sys.argv[1:]:
        report(load(p), p)
