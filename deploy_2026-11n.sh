#!/bin/bash
# deploy_2026-11n.sh — 第 11 批（3 主题 x 8 语种）稿件 + 9 张 Commons 图 + 署名
# 数据 JSON 在 Docker volume（必须 docker cp）；webp/CREDITS/imageCredits.ts 在镜像层（scp + build）
# deploy 前必须再查一次服务器批次列表与 articles 条数，防并发会话覆盖。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)
BATCH=2026-11n

JSONS="premium-$BATCH.json premium-en-$BATCH.json premium-ja-$BATCH.json premium-ko-$BATCH.json premium-es-$BATCH.json premium-fr-$BATCH.json premium-pt-$BATCH.json premium-tr-$BATCH.json"
WEBP="locust-cannibalism-scent-cover.webp locust-cannibalism-scent-fig1.webp locust-cannibalism-scent-fig2.webp fluorinated-electrolyte-battery-cover.webp fluorinated-electrolyte-battery-fig1.webp fluorinated-electrolyte-battery-fig2.webp smart-floss-metabolism-cover.webp smart-floss-metabolism-fig1.webp smart-floss-metabolism-fig2.webp"
OG="locust-cannibalism-scent.jpg fluorinated-electrolyte-battery.jpg smart-floss-metabolism.jpg"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 0. deploy 前最后复核服务器（防并发） ==="
ssh -o BatchMode=yes $SRV "docker exec $C sh -c 'ls -1 /app/data/original/ | grep -c $BATCH || true' && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));console.log(\"SERVER_TOTAL\",(Array.isArray(a)?a:(a.articles||[])).length)'"

echo "=== 1. 备份 ==="
ssh -o BatchMode=yes $SRV "mkdir -p /root/gh_archive && cd $REMOTE && cp -a public/original/CREDITS.json /root/gh_archive/CREDITS.json.bak-$BATCH-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-$BATCH-$TS && cp -a data/original /root/gh_archive/data-original.bak-$BATCH-$TS && echo backup done"

echo "=== 2. scp 8 个稿件 JSON 到宿主机源码树（仅保持源码一致） ==="
for f in $JSONS; do put "$LOCAL/data/original/$f" "data/original/$f"; done

echo "=== 3. docker cp 8 个 JSON 进容器 volume（真正生效的一步） ==="
for f in $JSONS; do
  if ! docker_cp_ok=$(ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$f $C:/app/data/original/$f" 2>&1); then
    echo "DOCKER CP FAIL: $f -> $docker_cp_ok"; exit 1
  fi
  echo "docker cp ok: $f"
done

echo "=== 4. scp 9 张 webp + 3 张 og + CREDITS + imageCredits.ts ==="
for f in $WEBP; do put "$LOCAL/public/original/$f" "public/original/$f"; done
ssh -o BatchMode=yes $SRV "mkdir -p $REMOTE/public/og"
for f in $OG; do put "$LOCAL/public/og/$f" "public/og/$f"; done
put "$LOCAL/public/original/CREDITS.json" "public/original/CREDITS.json"
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 5. 容器内幂等 reset（写入 articles.json / SQLite） ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -3"

echo "=== 6. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -5 && docker compose up -d 2>&1 | tail -4"

sleep 16
echo "=== 7. 二次 reset + RSS + IndexNow + 条数确认 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -3 && docker exec $C node scripts/indexnow.mjs 72 2>&1 | tail -3 && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"FINAL_TOTAL\",arr.length)'"

echo "=== 8. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 9. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/locust-cannibalism-scent-cover.webp"
cd "$LOCAL" && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/locust-cannibalism-scent-cover.webp

echo "=== deploy_2026-11n done ==="
