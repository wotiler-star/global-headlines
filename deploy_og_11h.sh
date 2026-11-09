#!/bin/bash
# deploy_og_11h.sh — 补传 2026-11h 的 3 张 1200x630 分享图（public/og 在镜像层，需 build）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
OGS="solar-flare-field.jpg gut-nad-precursor.jpg long-livephoto.jpg"

echo "=== 1. scp 3 张 og jpg ==="
for f in $OGS; do
  if ! scp -q "$LOCAL/public/og/$f" "$SRV:$REMOTE/public/og/$f"; then echo "SCP FAIL: $f"; exit 1; fi
  echo "scp ok: public/og/$f"
done

echo "=== 2. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -4 && docker compose up -d 2>&1 | tail -3"

sleep 12
echo "=== 3. 二次 reset + RSS（幂等，确认条数不变） ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2 && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"TOTAL\",arr.length);'"

echo "=== 4. 服务器侧 3 张 og 与本地 md5 对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE/public/og && md5sum $OGS"
cd "$LOCAL/public/og" && md5sum $OGS

echo "=== deploy_og_11h done ==="
