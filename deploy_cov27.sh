#!/bin/bash
# cov27 部署：地球仪小修 —— 修复 cov25 遗留「图例点击/分站直载镜头不转向」bug
#  - 根因：地球「进入视口才创建」（IntersectionObserver + 动态 import），存在 worldRef 为 null 的窗口期；
#    ?src=XXX 直载或页面 remount 时 active 已存在，但 [active] 镜头 effect 在该窗口内跳过 → 地球不转向该地区。
#  - 修法：地球初始化完成（worldRef.current = world）后，按当前 active 补转镜头（altitude 2.2，duration 0）。
#  - 仅改文件：src/components/SignalDeck.tsx
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov27_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov27-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/src/components/SignalDeck.tsx" "$SRV:$REMOTE/src/components/SignalDeck.tsx"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证（轮询等就绪）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov27 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/SignalDeck.tsx.bak-cov27-$TS $REMOTE/src/components/SignalDeck.tsx && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
