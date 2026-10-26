#!/usr/bin/env bash
# cov37：修复右侧信息面板溢出到页脚、遮挡「硬核」等按钮的问题（仅 globals.css）
set -e
cd /root/global-news-starteday
TS=$(date +%Y%m%d-%H%M%S)
STAGE=/root/gh_stage_cov37
mkdir -p "$STAGE"

echo "=== 1. 备份线上当前源码（用于回滚）==="
cp src/app/globals.css /root/gh_archive/globals.css.bak-cov37-$TS

echo "=== 2. 覆盖 cov37 新源码（来自暂存）==="
cp "$STAGE/globals.css" src/app/globals.css

echo "=== 3. 构建 global-headlines ==="
docker compose build global-headlines

echo "=== 4. 重启 ==="
docker compose up -d

echo "=== 5. 健康检查（启动管线需数分钟，先等 150s）==="
sleep 150
curl -s -o /dev/null -w 'ZH %{http_code}\n' http://localhost:8082/zh
curl -s -o /dev/null -w 'EN %{http_code}\n' http://localhost:8082/en
echo "DONE cov37"
