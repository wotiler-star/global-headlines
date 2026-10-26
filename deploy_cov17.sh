#!/bin/bash
# cov17 部署：性能（地球 WebGL 延迟初始化 + 卡片悬停预取）+ 移动端（touch-action / 触屏国家卡片 / 平板面板静态化）
# 改动文件：src/components/SignalDeck.tsx、src/app/globals.css、src/components/NewsCard.tsx
# 用法：在本地项目根目录运行（需能 ssh/scp 到服务器，且服务器 docker compose 可用）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov17_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov17-$TS && cp $REMOTE/src/app/globals.css /root/gh_archive/globals.css.bak-cov17-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/src/components/SignalDeck.tsx" "$SRV:$REMOTE/src/components/SignalDeck.tsx"
scp "$LOCAL/src/app/globals.css" "$SRV:$REMOTE/src/app/globals.css"
scp "$LOCAL/src/components/NewsCard.tsx" "$SRV:$REMOTE/src/components/NewsCard.tsx"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证 ==='
ssh "$SRV" "curl -s -o /dev/null -w 'ZH 首页 HTTP %{http_code}\n' http://127.0.0.1:8082/zh; curl -s -o /dev/null -w 'EN 首页 HTTP %{http_code}\n' http://127.0.0.1:8082/en"

echo "=== cov17 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/SignalDeck.tsx.bak-cov17-$TS $REMOTE/src/components/SignalDeck.tsx && cp /root/gh_archive/globals.css.bak-cov17-$TS $REMOTE/src/app/globals.css && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
