#!/bin/bash
# deploy_2026-11r.sh — APEC 综合篇 1 篇中文稿 + 3 张 Commons 图 + 署名
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)
BATCH=2026-11r
SLUG=apec-hawke-founder-story

JSONS="premium-$BATCH.json"
WEBP="$SLUG-cover.webp $SLUG-fig1.webp $SLUG-fig2.webp"
OG="$SLUG.jpg"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 0. deploy 前最后复核服务器（防并发） ==="
ssh -o BatchMode=yes $SRV "docker exec $C sh -c 'ls -1 /app/data/original/ | grep -c 2026-11r || true' && docker exec $C node -e 'const a=require(\"/app/data/articles.json\");const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"SERVER_TOTAL\",arr.length,\"zh\",arr.filter(x=>x.locale===\"zh\").length,\"apec\",arr.filter(x=>x.id.includes(\"apec\")).length)'"

echo "=== 1. 备份 ==="
ssh -o BatchMode=yes $SRV "mkdir -p /root/gh_archive && cd $REMOTE && cp -a public/original/CREDITS.json /root/gh_archive/CREDITS.json.bak-$BATCH-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-$BATCH-$TS && cp -a data/original /root/gh_archive/data-original.bak-$BATCH-$TS && echo backup done"

echo "=== 2. scp 稿件 JSON ==="
for f in $JSONS; do put "$LOCAL/data/original/$f" "data/original/$f"; done

echo "=== 3. docker cp JSON 进容器 volume ==="
for f in $JSONS; do
  if ! cp_ok=$(ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$f $C:/app/data/original/$f" 2>&1); then
    echo "DOCKER CP FAIL: $f -> $cp_ok"; exit 1
  fi
  echo "docker cp ok: $f"
done

echo "=== 4. scp webp + og + CREDITS + imageCredits.ts ==="
for f in $WEBP; do put "$LOCAL/public/original/$f" "public/original/$f"; done
ssh -o BatchMode=yes $SRV "mkdir -p $REMOTE/public/og"
for f in $OG; do put "$LOCAL/public/og/$f" "public/og/$f"; done
put "$LOCAL/public/original/CREDITS.json" "public/original/CREDITS.json"
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 5. 容器内幂等 reset ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -3"

echo "=== 6. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -4 && docker compose up -d 2>&1 | tail -3"

sleep 16
echo "=== 7. 二次 reset + RSS + IndexNow + 条数确认 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2 && docker exec $C node scripts/indexnow.mjs 72 2>&1 | tail -3 && docker exec $C node -e 'const a=require(\"/app/data/articles.json\");const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"FINAL_TOTAL\",arr.length,\"zh\",arr.filter(x=>x.locale===\"zh\").length,\"apec\",arr.filter(x=>x.id.includes(\"apec\")).length)'"

echo "=== 8. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 9. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/$SLUG-cover.webp"
cd "$LOCAL" && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/$SLUG-cover.webp

echo "=== deploy_2026-11r done ==="
