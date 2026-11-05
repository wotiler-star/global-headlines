# -*- coding: utf-8 -*-
"""
brand_cov41.py — starteday 全面品牌升级（文本层）
一次性、可重跑校验的机械替换。全部以 bytes 读写，保持原有 LF/CRLF 与编码不变。

设计基线（BRAND SYSTEM v1）
  名称    starteday（全小写，8 语种统一，不再做本地化译名）
  语义    开启每一天 / Start your day, informed
  图形    日轮 + 地平线（sunrise mark）
  主色    晨曦橙 #ff9248(深) / #c2410c(浅)，实心 #ea5f22
  字体    Space Grotesk 字标 + IBM Plex Mono 遥测数值（原有字体体系保留）
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BRAND = "start" + "eday"          # 防手误拼接：s-t-a-r-t-e-d-a-y
assert BRAND == "starteday"

# ---------------------------------------------------------------- 1. 多语言字典
# 每个语言块按字段名整行重写，不依赖旧值文本；每个字段必须命中且仅命中一次。
DICT = {
    "zh": dict(siteName=BRAND, tagline="从这里，开始每一天",
               footer=f"© 2026 {BRAND} · 全球资讯，每天从这里开始",
               homeTitle=f"{BRAND} - 全球资讯，开启每一天", heroTitle=BRAND),
    "en": dict(siteName=BRAND, tagline="Start your day, informed",
               footer=f"© 2026 {BRAND} · A clearer start to every day",
               homeTitle=f"{BRAND} - World news to start your day", heroTitle=BRAND),
    "ja": dict(siteName=BRAND, tagline="その日を、ここから始めよう",
               footer=f"© 2026 {BRAND} · 毎日を、もっとクリアに",
               homeTitle=f"{BRAND} - 世界のニュースで一日を始める", heroTitle=BRAND),
    "ko": dict(siteName=BRAND, tagline="오늘을 여기서 시작하세요",
               footer=f"© 2026 {BRAND} · 더 명확한 하루의 시작",
               homeTitle=f"{BRAND} - 세계 뉴스로 하루를 시작하세요", heroTitle=BRAND),
    "es": dict(siteName=BRAND, tagline="Empieza el día, bien informado",
               footer=f"© 2026 {BRAND} · Un comienzo más claro cada día",
               homeTitle=f"{BRAND} - Noticias del mundo para empezar el día", heroTitle=BRAND),
    "fr": dict(siteName=BRAND, tagline="Commencez la journée informé",
               footer=f"© 2026 {BRAND} · Un début plus clair chaque jour",
               homeTitle=f"{BRAND} - L'actualité du monde pour commencer la journée", heroTitle=BRAND),
    "pt": dict(siteName=BRAND, tagline="Comece o dia bem informado",
               footer=f"© 2026 {BRAND} · Um começo mais claro a cada dia",
               homeTitle=f"{BRAND} - Notícias do mundo para começar o dia", heroTitle=BRAND),
    "tr": dict(siteName=BRAND, tagline="Güne buradan, haberdar başlayın",
               footer=f"© 2026 {BRAND} · Her güne daha net bir başlangıç",
               homeTitle=f"{BRAND} - Güne dünya haberleriyle başlayın", heroTitle=BRAND),
}

p = ROOT / "src/i18n/dictionaries.ts"
lines = p.read_bytes().split(b"\n")
cur, hits = None, {}
for i, line in enumerate(lines):
    m = re.match(rb"^  (zh|en|ja|ko|es|fr|pt|tr): \{$", line)
    if m:
        cur = m.group(1).decode()
        hits.setdefault(cur, set())
        continue
    if cur is None:
        continue
    f = re.match(rb"^    (siteName|tagline|footer|homeTitle|heroTitle): .*,$", line)
    if f:
        key = f.group(1).decode()
        if key in DICT[cur]:
            val = DICT[cur][key].replace('"', '\\"')
            lines[i] = f'    {key}: "{val}",'.encode("utf-8")
            hits[cur].add(key)
for lang, keys in hits.items():
    missing = set(DICT[lang]) - keys
    if missing:
        sys.exit(f"[dictionaries] {lang} 缺字段: {missing}")
p.write_bytes(b"\n".join(lines))
print(f"[dictionaries] 8 语种 × 5 字段已统一为 {BRAND}")

# ---------------------------------------------------------------- 2. 精确文本替换
REPL = [
    # SEO / 结构化数据 / RSS 订阅名
    ("src/app/[locale]/layout.tsx", [
        (b'title="Global Headlines RSS"', b'title="starteday RSS"'),
        (b"var t=localStorage.getItem('gh_theme');",
         b"var t=localStorage.getItem('sd_theme')||localStorage.getItem('gh_theme');"),
    ]),
    ("src/components/ThemeToggle.tsx", [
        (b'localStorage.setItem("gh_theme", next);', b'localStorage.setItem("sd_theme", next);'),
    ]),
    # 站内中文残留
    ("src/components/AdSlot.tsx", [
        ("全球头条 · 流量变现计划".encode(), f"{BRAND} · 流量变现计划".encode()),
    ]),
    ("src/components/DecodeTitle.tsx", [
        ("全球头条信号遥测".encode(), f"{BRAND}信号遥测".encode()),
    ]),
    ("src/components/LeftRail.tsx", [(b'"\xe5\xa4\xb4"', b'"S"')]),
    ("src/components/MemberPanel.tsx", [(b'"\xe5\xa4\xb4"', b'"S"')]),
    # 404 页品牌色（警报红保留）
    ("src/app/not-found.tsx", [(b"#ffb224", b"#ff9248"), (b"#ffb224", b"#ff9248")]),
    # RSS feed 标题
    ("scripts/gen-rss.mjs", [
        ("`全球头条 (${loc})`".encode(), f"`{BRAND} (${{loc}})`".encode()),
        ('"全球头条 Global Headlines"'.encode(), f'"{BRAND} · Global News"'.encode()),
    ]),
    # 采集器 UA（对外可见，必须用新品牌）
    ("src/data/rssSource.ts", [
        (b"Mozilla/5.0 (GlobalHeadlines/1.0; +https://global-headlines.example.com)",
         b"Mozilla/5.0 (starteday-bot/1.0; +https://starteday.com)"),
    ]),
    ("scripts/collect-articles.mjs", [
        (b"Mozilla/5.0 (GlobalHeadlines/1.0; +https://www.starteday.com)",
         b"Mozilla/5.0 (starteday-bot/1.0; +https://starteday.com)"),
    ]),
    # 原创内容署名统一小写
    ("public/original/CREDITS.json", [
        (b"AI generated (Starteday editorial)", b"AI generated (starteday editorial)"),
    ]),
    ("public/original/tech-agents-fig1.svg", [
        ("Starteday 编辑部".encode(), f"{BRAND} 编辑部".encode()),
    ]),
    # 静态 fallback / PWA 缓存
    ("public/index.html", [(b"<title>Global Headlines</title>", b"<title>starteday</title>")]),
    ("public/sw.js", [
        (b"// Global Headlines \xe2\x80\x94 minimal service worker.",
         b"// starteday - minimal service worker."),
        (b'const CACHE = "gh-cache-v3";', b'const CACHE = "starteday-cache-v1";'),
    ]),
    # 包元信息（内部标识，同步品牌；服务名/数据卷不动，避免破坏部署）
    ("package.json", [(b'"name": "global-headlines"', b'"name": "starteday"')]),
    ("package-lock.json", [(b'"name": "global-headlines"', b'"name": "starteday"')]),
]

for rel, pairs in REPL:
    f = ROOT / rel
    data = f.read_bytes()
    for old, new in pairs:
        if old not in data:
            sys.exit(f"[repl] {rel}: 未找到 {old[:60]!r}")
        data = data.replace(old, new, 1)
    f.write_bytes(data)
    print(f"[repl] {rel}: {len(pairs)} 处")

# ---------------------------------------------------------------- 3. CSS 品牌系统
css = ROOT / "src/app/globals.css"
s = css.read_bytes()

OLD_VARS = b""":root {
  /* ===== \xe4\xbf\xa1\xe5\x8f\xb7\xe5\x8f\xb0 SIGNAL DECK \xc2\xb7 \xe6\xb7\xb1\xe7\xa9\xba\xef\xbc\x88\xe9\xbb\x98\xe8\xae\xa4\xe4\xb8\xbb\xe9\xa2\x98\xef\xbc\x89 ===== */"""
# 用正则截取首尾两个变量块（避免注释里的中文编码问题）
start = s.index(b":root {")
light = s.index(b'[data-theme="light"] {')
font_face = s.index(b"/* ===== ", light)
new_head = (
""":root {
  /* ===== starteday BRAND SYSTEM v1 · 深空（默认主题） ===== */
  --bg: #0a0e14;
  --surface: #10161f;
  --surface-2: #161e29;
  --input-bg: #161e29;
  --ink: #e8eef5;
  --ink-2: #93a4b8;
  --ink-3: #75839a;
  --line: #1e2836;
  --brand: #ff9248;
  --brand-dark: #e07a2c;
  --brand-solid: #ea5f22;
  --brand-solid-hover: #c94a12;
  --brand-2: #ffd166;
  --brand-grad: linear-gradient(135deg, #ffb347 0%, #ff7a3d 52%, #f0512a 100%);
  --on-brand: #0a0e14;
  --live: #3ddc97;
  --alert: #ff5c5c;
  --max: 1280px;
  --radius: 8px;
  --font-gk: "Space Grotesk", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --font-mn: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --text: var(--ink);
  --muted: var(--ink-2);
  --card: var(--surface);
  --brand-soft: rgba(255, 146, 72, 0.12);
}

/* ---------- starteday 白昼模式 DAYLIGHT OPS ---------- */
[data-theme="light"] {
  --bg: #f2f5f8;
  --surface: #ffffff;
  --surface-2: #e9edf2;
  --input-bg: #ffffff;
  --ink: #0c1218;
  --ink-2: #41505f;
  --ink-3: #5f6d7d;
  --line: #d7dee6;
  --brand: #c2410c;
  --brand-dark: #9a3412;
  --brand-solid: #b23c0a;
  --brand-solid-hover: #8f3008;
  --brand-2: #f59e0b;
  --on-brand: #ffffff;
  --live: #0c7d58;
  --alert: #c61d1d;
  --brand-soft: rgba(194, 65, 12, 0.10);
}

"""
).encode("utf-8")
s = s[:start] + new_head + s[font_face:]

# 遗留「头条红」硬编码 → 统一走品牌变量（实心按钮/徽标/高亮）
n_old = s.count(b"#f04142")
s = s.replace(b"#f04142", b"var(--brand-solid)")
s = s.replace(b"#d93839", b"var(--brand-solid-hover)")
print(f"[css] 遗留头条红替换 {n_old} 处")

# logo 区块重写
logo_start = s.index(b".logo {")
logo_end = s.index(b".search-form {", logo_start)
s = s[:logo_start] + (
""".logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-gk);
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
.logo-mark { flex: none; }

/* ===== starteday 品牌资产：日出标记 + 字标 ===== */
.brand-mark {
  display: inline-block;
  flex: none;
  border-radius: 9px;
  background: var(--brand-grad);
  color: #fff;
  box-shadow: 0 2px 10px rgba(240, 81, 42, 0.28);
}
.wordmark {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--font-gk);
  font-weight: 700;
  font-size: 21px;
  letter-spacing: -0.045em;
  line-height: 1;
  color: var(--ink);
}
.wordmark .wm-accent { color: var(--brand); }
.wordmark .wm-dot {
  width: 5px; height: 5px; margin-left: 3px;
  border-radius: 50%; background: var(--brand-2);
  align-self: flex-end; margin-bottom: 3px;
}
.sp-logo { display: inline-flex; align-items: center; }
.sp-logo .wordmark { font-size: 23px; }
.sp-logo .brand-mark { border-radius: 10px; }

"""
).encode("utf-8") + s[logo_end:]

# hero 品牌区
s = s.replace(
    b"background: radial-gradient(900px 260px at 50% -60px, rgba(59, 130, 246, 0.14), transparent 65%)",
    b"background: radial-gradient(900px 260px at 50% -60px, rgba(255, 122, 61, 0.16), transparent 65%)",
)
s = s.replace(
    b".tt-hero-title { margin: 0 0 14px; font-size: 30px; font-weight: 800; letter-spacing: 3px; color: #fff; }",
    b""".tt-hero-title {
  margin: 0 0 4px; font-family: var(--font-gk); font-size: clamp(34px, 5vw, 46px);
  font-weight: 700; letter-spacing: -0.04em; color: var(--ink);
}
.tt-hero-title .wm-accent { color: var(--brand); }
.tt-hero-tagline {
  margin: 0 0 18px; font-size: 13px; letter-spacing: 0.16em; color: var(--ink-3);
}""",
)
s = s.replace(
    b".sp-logo { font-size: 20px; font-weight: 800; color: var(--brand-solid); white-space: nowrap; letter-spacing: 1px; }",
    b".sp-logo { font-size: 20px; font-weight: 800; color: var(--brand); white-space: nowrap; letter-spacing: 1px; }",
)

# 页脚品牌行
s = s.replace(
    b".footer { text-align: center; color: var(--ink-3); font-size: 13px; padding: 28px 16px 40px; }",
    b""".footer {
  text-align: center; color: var(--ink-3); font-size: 13px; padding: 28px 16px 40px;
  border-top: 1px solid var(--line); margin-top: 40px;
}
.footer-brand { display: flex; align-items: center; justify-content: center; gap: 9px; flex-wrap: wrap; margin-bottom: 10px; }
.footer-brand .wordmark { font-size: 18px; }
.footer-tagline { font-size: 12px; letter-spacing: 0.08em; color: var(--ink-3); }
.footer-meta { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; }""",
)
css.write_bytes(s)
print("[css] 变量体系 / logo / hero / footer 已升级")

print("\nBRAND UPGRADE TEXT LAYER OK ->", BRAND)
