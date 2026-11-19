#!/bin/bash
# fix_deploy_dup_mouse.sh — 修复 slow-dopamine-taste-fig2 与 lipid-chain-aging-fig2 图片重复
# 仅 3 个文件：webp + CREDITS.json + imageCredits.ts（镜像层，需 build）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

put() {
  if ! scp -q "$1" "$SRV:$REMOTE/$2"; then echo "SCP FAIL: $2"; exit 1; fi
  echo "scp ok: $2"
}

echo "=== 1. 备份 ==="
ssh -o BatchMode=yes $SRV "mkdir -p /root/gh_archive && cd $REMOTE && cp -a public/original/slow-dopamine-taste-fig2.webp /root/gh_archive/slow-dopamine-taste-fig2.webp.bak-$TS && cp -a public/original/CREDITS.json /root/gh_archive/CREDITS.json.bak-fixdup-$TS && cp -a src/lib/imageCredits.ts /root/gh_archive/imageCredits.ts.bak-fixdup-$TS && echo backup done"

echo "=== 2. scp 3 个变更文件 ==="
put "$LOCAL/public/original/slow-dopamine-taste-fig2.webp" "public/original/slow-dopamine-taste-fig2.webp"
put "$LOCAL/public/original/CREDITS.json" "public/original/CREDITS.json"
put "$LOCAL/src/lib/imageCredits.ts" "src/lib/imageCredits.ts"

echo "=== 3. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -5 && docker compose up -d 2>&1 | tail -4"

sleep 16
echo "=== 4. nginx reload ==="
ssh -o BatchMode=yes $SRV "nginx -t && nginx -s reload && echo nginx reloaded"

echo "=== 5. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum public/original/slow-dopamine-taste-fig2.webp"
cd "$LOCAL" && md5sum public/original/slow-dopamine-taste-fig2.webp

echo "=== 6. 线上实证 ==="
ssh -o BatchMode=yes $SRV "curl -s -o /dev/null -w 'fig2 http=%{http_code} size=%{size_download}\n' http://127.0.0.1/original/slow-dopamine-taste-fig2.webp -H 'Host: www.starteday.com' || curl -s -o /dev/null -w 'fig2 http=%{http_code} size=%{size_download}\n' https://www.starteday.com/original/slow-dopamine-taste-fig2.webp"

echo "=== fix_deploy_dup_mouse done ==="
