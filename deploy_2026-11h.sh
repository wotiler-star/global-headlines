#!/bin/bash
# deploy_2026-11h.sh — 第 7 批 2026-11h：8 语种 JSON + 9 张 webp + CREDITS + imageCredits.ts
# 关键：data/original/*.json 在 Docker volume，必须 docker cp 进容器；public/original 在镜像层，scp + build 生效。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

JSONS="premium-2026-11h.json premium-en-2026-11h.json premium-ja-2026-11h.json premium-ko-2026-11h.json premium-es-2026-11h.json premium-fr-2026-11h.json premium-pt-2026-11h.json premium-tr-2026-11h.json"
IMGS="solar-flare-field-cover.webp solar-flare-field-fig1.webp solar-flare-field-fig2.webp gut-nad-precursor-cover.webp gut-nad-precursor-fig1.webp gut-nad-precursor-fig2.webp long-livephoto-cover.webp long-livephoto-fig1.webp long-livephoto-fig2.webp"

put() { # put <local> <remote-relative>
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 0. SSH 探测 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"

echo "=== 1. 服务器备份 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a data/original /root/gh_archive/data-original.bak-11h-$TS && cp -a public/original /root/gh_archive/public-original.bak-11h-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-11h-$TS && echo backup done"

echo "=== 2. scp 8 个 JSON（宿主机源码树，供 git 一致） ==="
for f in $JSONS; do
  put "$LOCAL/data/original/$f" "data/original/$f"
done

echo "=== 3. scp 9 张 webp + 署名（镜像层） ==="
for f in $IMGS CREDITS.json; do
  put "$LOCAL/public/original/$f" "public/original/$f"
done
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 4. docker cp 8 个 JSON 进容器 volume（运行时唯一生效路径） ==="
for f in $JSONS; do
  if ! ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$f $C:/app/data/original/$f"; then echo "docker cp FAIL: $f"; exit 1; fi
  echo "docker cp ok: $f"
done

echo "=== 5. 旧容器内幂等 reset ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -3"

echo "=== 6. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -5 && docker compose up -d 2>&1 | tail -3"

sleep 15
echo "=== 7. 新容器二次 reset + RSS + 条数自检（以 SQLite/articles.json 为准） ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -3 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -4 && docker exec $C node -e 'const a=JSON.parse(require(\"fs\").readFileSync(\"/app/data/articles.json\",\"utf8\"));const arr=Array.isArray(a)?a:(a.articles||[]);const m={};for(const x of arr)m[x.locale]=(m[x.locale]||0)+1;console.log(\"TOTAL\",arr.length,JSON.stringify(m));'"

echo "=== 8. IndexNow 推送 ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/indexnow.mjs 2>&1 | tail -2"

echo "=== 9. reload nginx ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 10. 服务器侧 md5 对齐自检 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/CREDITS.json src/lib/imageCredits.ts"
cd "$LOCAL" && md5sum public/original/CREDITS.json src/lib/imageCredits.ts

echo "=== deploy_2026-11h done ==="
