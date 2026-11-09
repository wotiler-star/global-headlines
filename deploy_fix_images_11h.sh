#!/bin/bash
# deploy_fix_images_11h.sh — 部署 2 张替换图 + 3 张本批新增 og 图 + 署名文件
# public/original 与 public/og 都在镜像层，需 scp + docker compose build
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

WEBP="oled-ipad-mini-cover.webp solar-flare-field-fig1.webp"
OG="solar-flare-field.jpg gut-nad-precursor.jpg long-livephoto.jpg oled-ipad-mini.jpg"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. 备份 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && cp -a public/original /root/gh_archive/public-original.bak-fiximg-$TS && cp -a public/og /root/gh_archive/public-og.bak-fiximg-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-fiximg-$TS && echo backup done"

echo "=== 2. scp 2 张替换 webp + CREDITS + imageCredits.ts ==="
for f in $WEBP; do put "$LOCAL/public/original/$f" "public/original/$f"; done
put "$LOCAL/public/original/CREDITS.json" "public/original/CREDITS.json"
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 3. scp 3 张本批新增 og + 2 张重生成 og ==="
for f in $OG; do put "$LOCAL/public/og/$f" "public/og/$f"; done

echo "=== 4. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -4 && docker compose up -d 2>&1 | tail -3"

sleep 14
echo "=== 5. 幂等 reset + RSS + 条数确认 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2 && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"TOTAL\",arr.length);'"

echo "=== 6. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 7. md5 对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/CREDITS.json src/lib/imageCredits.ts"
cd "$LOCAL" && md5sum public/original/CREDITS.json src/lib/imageCredits.ts

echo "=== deploy_fix_images_11h done ==="
