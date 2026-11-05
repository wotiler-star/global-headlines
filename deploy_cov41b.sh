#!/bin/bash
# deploy_cov41b.sh — 字标文本流热修：.wordmark 由 inline-flex 改 inline
# 原因：Chrome innerText 会在 flex 子项间插入换行，品牌名被复制成 "start\neday"。
# 只涉及 src/app/globals.css，其余 cov41 产物保持不变。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov41b_$TS.log
F=src/app/globals.css

ssh "$SRV" "cp '$REMOTE/$F' '/root/gh_archive/globals.css.bak-cov41b-$TS'"
scp -q "$LOCAL/$F" "$SRV:$REMOTE/$F" || { echo "推送失败"; exit 1; }
echo "已推送 $F"

ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -60 "$LOG"; exit 1; }
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -2
sleep 8
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -1 || true

for i in $(seq 1 20); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo "=== cov41b 完成 ==="
echo "回滚：ssh $SRV \"cp /root/gh_archive/globals.css.bak-cov41b-$TS $REMOTE/$F && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines\""
