#!/usr/bin/env bash
# cov36：地球仪「硬核模式」（视觉/交互拉满）— 仅叠加 SignalDeck.tsx + globals.css
set -e
cd /root/global-news-starteday
TS=$(date +%Y%m%d-%H%M%S)
STAGE=/root/gh_stage_cov36
mkdir -p "$STAGE"

echo "=== 1. 备份线上当前源码（用于回滚）==="
cp src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov36-$TS
cp src/app/globals.css /root/gh_archive/globals.css.bak-cov36-$TS

echo "=== 2. 覆盖 cov36 新源码（来自暂存）==="
cp "$STAGE/SignalDeck.tsx" src/components/SignalDeck.tsx
cp "$STAGE/globals.css" src/app/globals.css

echo "=== 3. 构建 global-headlines ==="
docker compose build global-headlines

echo "=== 4. 重启 ==="
docker compose up -d

echo "=== 5. 健康检查 ==="
sleep 5
curl -s -o /dev/null -w 'ZH %{http_code}\n' http://localhost:8082/zh
curl -s -o /dev/null -w 'EN %{http_code}\n' http://localhost:8082/en
echo "DONE cov36"
