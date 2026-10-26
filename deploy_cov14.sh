#!/bin/bash
# cov14 部署：悬停地球国家 → 出现对应分站卡片（含 Taiwan→中国台湾 合规名修正）
set -e
cd /root/global-news-starteday
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/gh_archive

echo '=== 1. 备份（项目外）==='
cp src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov14-$TS
cp src/lib/sourceGeo.ts /root/gh_archive/sourceGeo.ts.bak-cov14-$TS
cp src/app/globals.css /root/gh_archive/globals.css.bak-cov14-$TS

echo '=== 2. 构建 ==='
LOG=/root/gh_build_cov14_$TS.log
docker compose build global-headlines > $LOG 2>&1 && echo 构建成功 || { echo 构建失败:; tail -30 $LOG; exit 1; }

echo '=== 3. 重启与验证 ==='
docker compose up -d global-headlines 2>&1 | tail -2
sleep 8
docker ps --filter name=global-headlines --format '{{.Status}}'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:8082/zh
