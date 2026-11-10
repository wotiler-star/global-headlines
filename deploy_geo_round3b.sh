#!/bin/bash
# deploy_geo_round3b.sh — 主题实体落地页 /[locale]/topic/<slug>
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

PLAIN="src/lib/topics.ts src/app/sitemap.ts src/lib/seoTools.ts src/app/globals.css"
TOPIC_DIR="src/app/[locale]/topic/[slug]"
TOPIC_PAGE="$TOPIC_DIR/page.tsx"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. SSH + 备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-geo3b-$TS && echo backup ok"

echo "=== 2. 建远程方括号目录 ==="
ssh -o BatchMode=yes $SRV "mkdir -p '$REMOTE/$TOPIC_DIR' && echo dir ok"

echo "=== 3. scp 普通文件 ==="
for f in $PLAIN; do put "$LOCAL/$f" "$f"; done

echo "=== 4. scp 新页面（/tmp 中转） ==="
scp -q "$LOCAL/$TOPIC_PAGE" "$SRV:/tmp/topic_page_$TS.tsx"
ssh -o BatchMode=yes $SRV "mv /tmp/topic_page_$TS.tsx '$REMOTE/$TOPIC_PAGE' && echo topic page ok"

echo "=== 5. build && up -d（232 个静态页，稍久） ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -8 && docker compose up -d 2>&1 | tail -3"

sleep 15
echo "=== 6. 线上验收 ==="
ssh -o BatchMode=yes $SRV "
for u in / /zh/topic/china-webnovel-global /en/topic/china-webnovel-global /tr/topic/photonic-memristor /llms.txt /llms-full.txt /sitemap.xml; do
  printf '%-46s' \$u; curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8082\$u
done
echo -n 'sitemap /topic/ 条数: '; curl -s 127.0.0.1:8082/sitemap.xml | grep -c '/topic/'
echo -n 'llms 实体链接数: '; curl -s 127.0.0.1:8082/llms.txt | grep -c '实体档案$'
echo -n '主题页 Thing/CollectionPage: '; curl -s 127.0.0.1:8082/zh/topic/china-webnovel-global | grep -o 'CollectionPage\|Thing' | sort -u | tr '\n' ' '; echo
echo -n '文章页 Speakable/Claim: '; curl -s 127.0.0.1:8082/zh/article/rss-orig-china-webnovel-global-2026-11j | grep -o 'SpeakableSpecification\|\"Claim\"' | sort -u | tr '\n' ' '; echo
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
"

echo "=== 7. RSS + IndexNow + nginx ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2; docker exec $C node scripts/indexnow.mjs 2>&1 | tail -2; nginx -t >/dev/null 2>&1 && nginx -s reload && echo nginx reloaded"

echo "=== 8. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $PLAIN '$TOPIC_PAGE' 'src/app/[locale]/article/[id]/page.tsx' 'src/app/[locale]/tag/[slug]/page.tsx'"
cd "$LOCAL" && md5sum $PLAIN "$TOPIC_PAGE" "src/app/[locale]/article/[id]/page.tsx" "src/app/[locale]/tag/[slug]/page.tsx"
echo "=== deploy_geo_round3b done ==="
