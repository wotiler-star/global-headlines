#!/bin/bash
# deploy_backlink_seo.sh — 外链优化部署
# 新增：/[locale]/about 可引用资产页（8 语种）、Atom feed、RSS 分发信号、实体结构化数据
# 关键：public/ 与 src/ 在镜像层需 scp + build；data/articles.json 在 volume 由容器内 reset 维护。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

# 普通文件（不含方括号）
PLAIN="src/app/globals.css src/app/sitemap.ts src/lib/seoTools.ts scripts/gen-rss.mjs src/app/robots.ts src/i18n/citePage.ts src/components/CiteCopyButton.tsx"
# 方括号路径：scp 目标含 [] 会被 shell 展开，经 /tmp 中转再 mv
BRACKET_SRC="src/app/[locale]/layout.tsx|src/app/[locale]/article/[id]/page.tsx"
# 带点的路由目录：scp 不自动建目录，先 mkdir -p
DOT_DIRS="src/app/atom.xml"
# 新建页面目录
NEW_DIRS="src/app/[locale]/about"

put() { # put <local> <remote-relative>
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 0. SSH 探测 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"

echo "=== 1. 服务器备份 ==="
# 注意：public/rss.xml 由容器内 gen-rss.mjs 写到 volume，宿主机源码树里可能不存在，
# 不能用 set -e 下的 cp 硬备份它（曾导致部署在第一步中断）。
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && \
  cp -a src /root/gh_archive/src.bak-backlink-$TS && \
  cp -a scripts /root/gh_archive/scripts.bak-backlink-$TS && \
  (cp -a public/rss.xml /root/gh_archive/rss.xml.bak-backlink-$TS 2>/dev/null || true) && echo backup done"

echo "=== 2. 先建远程目录（带点路由 / 方括号 / 新页面）==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p '$DOT_DIRS' '$NEW_DIRS' && echo dirs ok"

echo "=== 3. scp 普通源码文件 ==="
for f in $PLAIN; do put "$LOCAL/$f" "$f"; done

echo "=== 4. scp 新页面（/tmp 中转，避开方括号）==="
scp -q "$LOCAL/src/app/[locale]/about/page.tsx" "$SRV:/tmp/about_page_$TS.tsx"
ssh -o BatchMode=yes $SRV "mv /tmp/about_page_$TS.tsx '$REMOTE/src/app/[locale]/about/page.tsx' && echo about page ok"

echo "=== 5. scp 方括号路径的既有文件（/tmp 中转）==="
for pair in "src/app/[locale]/layout.tsx:layout.tsx" "src/app/[locale]/article/[id]/page.tsx:artpage.tsx"; do
  src="${pair%%:*}"; tmp="${pair##*:}"
  scp -q "$LOCAL/$src" "$SRV:/tmp/${tmp}_$TS"
  ssh -o BatchMode=yes $SRV "mv /tmp/${tmp}_$TS '$REMOTE/$src' && echo bracket ok: $src"
done

echo "=== 6. scp Atom route（带点目录已建）==="
scp -q "$LOCAL/src/app/atom.xml/route.ts" "$SRV:/tmp/atom_route_$TS.ts"
ssh -o BatchMode=yes $SRV "mv /tmp/atom_route_$TS.ts '$REMOTE/src/app/atom.xml/route.ts' && echo atom route ok"

echo "=== 7. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -3"

sleep 15
echo "=== 8. 容器内幂等 reset + gen-rss + 条数确认 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && \
  docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -10 && \
  docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const x=Array.isArray(a)?a:(a.articles||[]);console.log(\"TOTAL\",x.length);'"

echo "=== 9. IndexNow 推送新页 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/indexnow.mjs 2>&1 | tail -2"

echo "=== 10. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 11. 服务器侧 md5 对齐自检 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum src/app/globals.css src/app/sitemap.ts src/lib/seoTools.ts scripts/gen-rss.mjs"
cd "$LOCAL" && md5sum src/app/globals.css src/app/sitemap.ts src/lib/seoTools.ts scripts/gen-rss.mjs

echo "=== deploy_backlink_seo done ==="
