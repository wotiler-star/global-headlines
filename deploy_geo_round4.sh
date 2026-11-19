#!/bin/bash
# deploy_geo_round4.sh — 发布者实体升级 NewsMediaOrganization（layout/about/article 三处）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

# 三个文件全带方括号路径，scp 走 /tmp 中转避免 SFTP 把括号当字面量
L=src/app/[locale]/layout.tsx
A=src/app/[locale]/about/page.tsx
P=src/app/[locale]/article/[id]/page.tsx
FILES="$L $A $P"

echo "=== 1. SSH + 备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-geo4-$TS && echo backup ok"

echo "=== 2. /tmp 中转 scp 三个方括号文件 ==="
for f in $FILES; do
  scp -q "$LOCAL/$f" "$SRV:/tmp/geo4_$(basename $f)_$TS.tsx"
  ssh -o BatchMode=yes $SRV "mv /tmp/geo4_$(basename $f)_$TS.tsx '$REMOTE/$f' && echo 'put ok: $f'"
done

echo "=== 3. build && up -d（layout 改动触发全站静态重建） ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -8 && docker compose up -d 2>&1 | tail -3"

sleep 15
echo "=== 4. 验收：渲染 HTML 含 NewsMediaOrganization ==="
ssh -o BatchMode=yes $SRV "
for u in / /zh/about /en/about /zh/article/rss-orig-china-webnovel-global-2026-11j; do
  printf '%-56s' \$u
  code=\$(curl -s -o /tmp/p.html -w '%{http_code}' 127.0.0.1:8082\$u)
  echo -n \"\$code  \"
  echo -n 'NewsMediaOrganization='; grep -o 'NewsMediaOrganization' /tmp/p.html | head -1 | tr -d '\n'
  echo -n '  availableLanguage='; grep -o '\"availableLanguage\":\[[^]]*\]' /tmp/p.html | head -1 | cut -c1-40
  echo
done
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
rm -f /tmp/p.html
"

echo "=== 5. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $FILES"
cd "$LOCAL" && md5sum $FILES
echo "=== deploy_geo_round4 done ==="
