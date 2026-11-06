#!/bin/bash
# deploy_cov56.sh — 第三批 2026-11c：8 语种 JSON + 9 张 webp + CREDITS + imageCredits.ts
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

put() { # put <local> <remote-relative>
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. 服务器备份 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a data/original /root/gh_archive/data-original.bak-cov56-$TS && cp -a public/original /root/gh_archive/public-original.bak-cov56-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-cov56-$TS && echo backup done"

echo "=== 2. scp JSON（宿主机源码树，供 git 一致） ==="
for f in premium-2026-11c.json premium-en-2026-11c.json premium-ja-2026-11c.json premium-ko-2026-11c.json premium-es-2026-11c.json premium-fr-2026-11c.json premium-pt-2026-11c.json premium-tr-2026-11c.json; do
  put "$LOCAL/data/original/$f" "data/original/$f"
done

echo "=== 3. scp 图片与署名（镜像层） ==="
for f in harmony-desktop-cover.webp harmony-desktop-fig1.webp harmony-desktop-fig2.webp oil-membrane-cover.webp oil-membrane-fig1.webp oil-membrane-fig2.webp chemo-neuro-cover.webp chemo-neuro-fig1.webp chemo-neuro-fig2.webp CREDITS.json; do
  put "$LOCAL/public/original/$f" "public/original/$f"
done
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 4. docker cp JSON 进容器 volume（运行时唯一生效路径） ==="
for f in premium-2026-11c.json premium-en-2026-11c.json premium-ja-2026-11c.json premium-ko-2026-11c.json premium-es-2026-11c.json premium-fr-2026-11c.json premium-pt-2026-11c.json premium-tr-2026-11c.json; do
  if ! ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$f $C:/app/data/original/$f"; then echo "docker cp FAIL: $f"; exit 1; fi
  echo "docker cp ok: $f"
done

echo "=== 5. 旧容器内幂等 reset ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2"

echo "=== 6. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -3 && docker compose up -d 2>&1 | tail -2"

sleep 12
echo "=== 7. 新容器二次 reset + RSS ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2 && docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -3 && docker exec $C sh -c 'wc -c /app/data/articles.json' && curl -s http://127.0.0.1:8082/api/articles | head -c 120"

echo "=== deploy_cov56 done ==="
