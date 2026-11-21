#!/bin/bash
# deploy_2026-11q.sh — 3 主题 × 8 语种 = 24 稿 + 9 张 Commons webp + 3 og + 署名
# 数据 JSON 在 Docker volume（必须 docker cp）；webp/CREDITS/imageCredits.ts 在镜像层（scp + build）
# 沿用 11p 模板；deploy 前最后再查一次服务器批次列表与 articles 条数，防并发会话覆盖。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)
BATCH=2026-11q

JSONS="premium-$BATCH.json premium-en-$BATCH.json premium-ja-$BATCH.json premium-ko-$BATCH.json premium-es-$BATCH.json premium-fr-$BATCH.json premium-pt-$BATCH.json premium-tr-$BATCH.json"
WEBP="twisted-oxide-moire-cover.webp twisted-oxide-moire-fig1.webp twisted-oxide-moire-fig2.webp glucose-powered-neuroaxis-cover.webp glucose-powered-neuroaxis-fig1.webp glucose-powered-neuroaxis-fig2.webp folding-steering-suv-cover.webp folding-steering-suv-fig1.webp folding-steering-suv-fig2.webp"
OG="twisted-oxide-moire.jpg glucose-powered-neuroaxis.jpg folding-steering-suv.jpg"

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 0. deploy 前最后复核服务器（防并发） ==="
ssh -o BatchMode=yes $SRV "docker exec $C sh -c 'ls -1 /app/data/original/ | grep -c 2026-11q || true' && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);console.log(\"SERVER_TOTAL\",arr.length,\"zh\",arr.filter(x=>x.locale===\"zh\").length,\"en\",arr.filter(x=>x.locale===\"en\").length)'"

echo "=== 1. 备份 ==="
ssh -o BatchMode=yes $SRV "mkdir -p /root/gh_archive && cd $REMOTE && cp -a public/original/CREDITS.json /root/gh_archive/CREDITS.json.bak-$BATCH-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-$BATCH-$TS && cp -a data/original /root/gh_archive/data-original.bak-$BATCH-$TS && echo backup done"

echo "=== 2. scp 8 个稿件 JSON 到宿主机源码树 ==="
for f in $JSONS; do put "$LOCAL/data/original/$f" "data/original/$f"; done

echo "=== 3. docker cp 8 个 JSON 进容器 volume（真正生效的一步） ==="
for f in $JSONS; do
  if ! cp_ok=$(ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$f $C:/app/data/original/$f" 2>&1); then
    echo "DOCKER CP FAIL: $f -> $cp_ok"; exit 1
  fi
  echo "docker cp ok: $f"
done

echo "=== 4. scp 9 webp + 3 og + CREDITS + imageCredits.ts ==="
for f in $WEBP; do put "$LOCAL/public/original/$f" "public/original/$f"; done
ssh -o BatchMode=yes $SRV "mkdir -p $REMOTE/public/og"
for f in $OG; do put "$LOCAL/public/og/$f" "public/og/$f"; done
put "$LOCAL/public/original/CREDITS.json" "public/original/CREDITS.json"
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 5. 容器内幂等 reset（写入 articles.json / SQLite） ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs 2>&1 | tail -3"

echo "=== 6. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -4"

sleep 18
echo "=== 7. 二次 reset + RSS + IndexNow + 条数确认 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs 2>&1 | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -3 && docker exec $C node scripts/indexnow.mjs 72 2>&1 | tail -3 && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);const m={};arr.forEach(x=>m[x.locale]=(m[x.locale]||0)+1);console.log(\"FINAL_TOTAL\",arr.length,\"BY_LOCALE\",JSON.stringify(m))'"

echo "=== 8. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 9. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/twisted-oxide-moire-cover.webp public/original/glucose-powered-neuroaxis-cover.webp public/original/folding-steering-suv-cover.webp"
cd "$LOCAL" && md5sum public/original/CREDITS.json src/lib/imageCredits.ts public/original/twisted-oxide-moire-cover.webp public/original/glucose-powered-neuroaxis-cover.webp public/original/folding-steering-suv-cover.webp

echo "=== deploy_2026-11q done ==="
