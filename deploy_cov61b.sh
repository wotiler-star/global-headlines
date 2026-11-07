#!/bin/bash
# deploy_cov61b.sh — Google/多引擎 SEO 优化：ImageObject 结构化数据 + IndexNow + 验证环境变量
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
KEY=a7f3c91e5b2d4806fae13c7d95b26e4f01

echo "=== 1. 上传代码与 key（方括号路径经 /tmp 中转） ==="
scp -q "$LOCAL/src/app/[locale]/article/[id]/page.tsx" "$SRV:/tmp/article-page.tsx"
scp -q "$LOCAL/src/app/[locale]/layout.tsx" "$SRV:/tmp/locale-layout.tsx"
scp -q "$LOCAL/public/$KEY.txt" "$SRV:$REMOTE/public/$KEY.txt"
scp -q "$LOCAL/scripts/indexnow.mjs" "$SRV:$REMOTE/scripts/indexnow.mjs"
ssh -o BatchMode=yes $SRV "mv /tmp/article-page.tsx '$REMOTE/src/app/[locale]/article/[id]/page.tsx' && mv /tmp/locale-layout.tsx '$REMOTE/src/app/[locale]/layout.tsx' && echo uploaded"

echo "=== 2. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -2 && docker compose up -d 2>&1 | tail -1"

sleep 12
echo "=== 3. key 文件与页面 ==="
for u in "/$KEY.txt" "/zh/article/rss-orig-cold-atoms-2026-11"; do
  code=$(ssh -o BatchMode=yes $SRV "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8082'$u'")
  echo "$code $u"
done

echo "=== 4. IndexNow 推送 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/indexnow.mjs 72" || echo "[warn] IndexNow 推送失败（不阻断部署）"

echo "=== 5. reset + RSS ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs 2>/dev/null | tail -1 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -1"
echo "=== deploy_cov61b done ==="
