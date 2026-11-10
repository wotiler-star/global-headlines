#!/bin/bash
# deploy_geo_round2.sh — GEO 第二轮：llms-full.txt / 站点事实 / AI 爬虫放行 / 8 语种 FAQPage
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

PLAIN="src/lib/seoTools.ts src/app/robots.ts src/i18n/faqQuestions.ts src/app/globals.css"
NEW_DOT_DIR="src/app/llms-full.txt"
BRACKET="src/app/[locale]/about/page.tsx"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. SSH 探测 + 服务器备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-geo2-$TS && echo backup ok"

echo "=== 2. 建带点路由目录 ==="
ssh -o BatchMode=yes $SRV "mkdir -p '$REMOTE/$NEW_DOT_DIR' && echo dir ok"

echo "=== 3. scp 普通源码文件 ==="
for f in $PLAIN; do put "$LOCAL/$f" "$f"; done

echo "=== 4. scp 新路由 + 方括号页面（/tmp 中转避开 shell 展开） ==="
scp -q "$LOCAL/$NEW_DOT_DIR/route.ts" "$SRV:/tmp/llms_full_route_$TS.ts"
ssh -o BatchMode=yes $SRV "mv /tmp/llms_full_route_$TS.ts '$REMOTE/$NEW_DOT_DIR/route.ts' && echo llms-full route ok"
scp -q "$LOCAL/$BRACKET" "$SRV:/tmp/about_page_geo2_$TS.tsx"
ssh -o BatchMode=yes $SRV "mv /tmp/about_page_geo2_$TS.tsx '$REMOTE/$BRACKET' && echo about page ok"

echo "=== 5. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -3"

sleep 12
echo "=== 6. 线上验收 ==="
ssh -o BatchMode=yes $SRV "
for u in /llms.txt /llms-full.txt /robots.txt /humans.txt /zh/about /en/about /tr/about; do
  printf '%-26s' \$u; curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8082\$u
done
echo -n 'llms-full 文章行数: '; curl -s 127.0.0.1:8082/llms-full.txt | grep -c '^- \['
echo -n 'llms-full 语种分组: '; curl -s 127.0.0.1:8082/llms-full.txt | grep -c '^### '
echo -n 'robots AI UA 数: '; curl -s 127.0.0.1:8082/robots.txt | grep -c '^User-agent:'
echo -n 'zh/about FAQPage: '; curl -s 127.0.0.1:8082/zh/about | grep -c 'FAQPage'
echo -n 'tr/about FAQPage: '; curl -s 127.0.0.1:8082/tr/about | grep -c 'FAQPage'
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
"

echo "=== 7. RSS + IndexNow + nginx reload ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2; docker exec $C node scripts/indexnow.mjs 2>&1 | tail -2; nginx -t >/dev/null 2>&1 && nginx -s reload && echo nginx reloaded"

echo "=== 8. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $PLAIN '$NEW_DOT_DIR/route.ts' '$BRACKET'"
cd "$LOCAL" && md5sum $PLAIN "$NEW_DOT_DIR/route.ts" "$BRACKET"
echo "=== deploy_geo_round2 done ==="
