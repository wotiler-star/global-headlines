#!/bin/bash
# deploy_geo_round3.sh — GEO 第三轮：文章页 speakable/Claim/实体标注 + tag 页升级实体档案
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

PLAIN="src/lib/seoTools.ts src/app/globals.css"
BRACKETS="src/app/[locale]/article/[id]/page.tsx|artpage.tsx src/app/[locale]/tag/[slug]/page.tsx|tagpage.tsx"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. SSH + 备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-geo3-$TS && echo backup ok"

echo "=== 2. scp 普通文件 ==="
for f in $PLAIN; do put "$LOCAL/$f" "$f"; done

echo "=== 3. scp 方括号路径（/tmp 中转） ==="
for pair in $BRACKETS; do
  src="${pair%%|*}"; tmp="${pair##*|}"
  scp -q "$LOCAL/$src" "$SRV:/tmp/${tmp}_geo3_$TS"
  ssh -o BatchMode=yes $SRV "mv /tmp/${tmp}_geo3_$TS '$REMOTE/$src' && echo bracket ok: $src"
done

echo "=== 4. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -3"

sleep 12
echo "=== 5. 线上冒烟 ==="
ssh -o BatchMode=yes $SRV "
for u in / /llms.txt /llms-full.txt /robots.txt /zh/about /sitemap.xml; do
  printf '%-24s' \$u; curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8082\$u
done
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
echo -n 'llms 实体段: '; curl -s 127.0.0.1:8082/llms.txt | grep -c '实体与话题档案'
echo -n 'llms 实体链接数: '; curl -s 127.0.0.1:8082/llms.txt | grep -c '实体档案$'
"

echo "=== 6. RSS + IndexNow + nginx ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2; docker exec $C node scripts/indexnow.mjs 2>&1 | tail -2; nginx -t >/dev/null 2>&1 && nginx -s reload && echo nginx reloaded"

echo "=== 7. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $PLAIN 'src/app/[locale]/article/[id]/page.tsx' 'src/app/[locale]/tag/[slug]/page.tsx'"
cd "$LOCAL" && md5sum $PLAIN "src/app/[locale]/article/[id]/page.tsx" "src/app/[locale]/tag/[slug]/page.tsx"
echo "=== deploy_geo_round3 done ==="
