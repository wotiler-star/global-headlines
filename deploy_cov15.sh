#!/bin/bash
# cov15 部署：悬停地球国家 → 出现对应分站「可点击新闻列表」+ 修复 ?src 信息流过滤断链
set -e
cd /root/global-news-starteday
TS=$(date +%Y%m%d_%H%M%S)
STAGE=/root/gh_stage_cov15
mkdir -p /root/gh_archive

echo '=== 1. 备份当前线上源码 ==='
cp src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov15-$TS
cp src/lib/sourceGeo.ts /root/gh_archive/sourceGeo.ts.bak-cov15-$TS
cp src/app/globals.css /root/gh_archive/globals.css.bak-cov15-$TS
cp src/components/HomeFeedRouter.tsx /root/gh_archive/HomeFeedRouter.tsx.bak-cov15-$TS

echo '=== 2. 覆盖新源码（来自暂存）==='
cp $STAGE/src/components/SignalDeck.tsx src/components/SignalDeck.tsx
cp $STAGE/src/lib/sourceGeo.ts src/lib/sourceGeo.ts
cp $STAGE/src/app/globals.css src/app/globals.css
cp $STAGE/src/components/HomeFeedRouter.tsx src/components/HomeFeedRouter.tsx

echo '=== 3. 构建 ==='
LOG=/root/gh_build_cov15_$TS.log
docker compose build global-headlines > $LOG 2>&1 && echo 构建成功 || { echo 构建失败:; tail -40 $LOG; exit 1; }

echo '=== 4. 重启与验证 ==='
docker compose up -d global-headlines 2>&1 | tail -2
sleep 8
docker ps --filter name=global-headlines --format '{{.Status}}'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:8082/zh
