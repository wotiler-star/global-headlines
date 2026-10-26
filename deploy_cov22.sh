#!/bin/bash
# cov22 部署：地球仪视觉精细化——NASA Blue Marble 日间真实贴图 + WebP 凹凸图 + 苹果蓝大气光晕 + 三点式布光
# 改动文件：
#   src/components/SignalDeck.tsx（globeImageUrl→earth-day.webp；bumpImageUrl→earth-topology.webp；
#     atmosphereColor #ffb224→#5aa9ff、altitude 0.22→0.18；arc 透明度微调；
#     新增 lights() 三点布光：环境光提亮 + 主光(右上前) + 冷蓝补光(左前下)，修默认单侧光暗面死黑）
#   public/img/earth-day.webp（新增，4096×2048 WebP q78，581KB——比原 earth-night.jpg 715KB 更小更清晰）
#   public/img/earth-topology.webp（新增，2048 灰度 WebP，38KB——原 PNG 378KB 的 1/10）
# 注意：public/ 是构建期烤进镜像的，必须 scp 贴图 + 重新 build。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov22_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov22-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器（源码 + 贴图）==='
scp "$LOCAL/src/components/SignalDeck.tsx" "$SRV:$REMOTE/src/components/SignalDeck.tsx"
scp "$LOCAL/public/img/earth-day.webp" "$SRV:$REMOTE/public/img/earth-day.webp"
scp "$LOCAL/public/img/earth-topology.webp" "$SRV:$REMOTE/public/img/earth-topology.webp"
echo "推送完成"

echo '=== 3. 构建镜像（public/ 烤进镜像）==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证（轮询等就绪）==='
for i in $(seq 1 18); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done
echo "  贴图 HTTP 检查："
ssh "$SRV" "curl -s -o /dev/null -w '  earth-day.webp %{http_code} %{size_download}B\n' http://127.0.0.1:8082/img/earth-day.webp; curl -s -o /dev/null -w '  earth-topology.webp %{http_code} %{size_download}B\n' http://127.0.0.1:8082/img/earth-topology.webp"

echo "=== cov22 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/SignalDeck.tsx.bak-cov22-$TS $REMOTE/src/components/SignalDeck.tsx && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
