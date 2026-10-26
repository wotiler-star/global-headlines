#!/bin/bash
# cov28 部署：数据覆盖扩充（葡语/土耳其/东南亚分站）+ 首页响应式打磨
#  - 数据层（src/lib/sourceGeo.ts）：新增城市信号点 BKK/JKT/KUL/SIN/LAD/MPM/RIO
#    + DOMAIN_TO_CODE 映射 + COUNTRY_STATIONS 国家映射；修复 IST 死站（dailysabah 此前漏进采集器）。
#  - 采集层（scripts/collect-articles.mjs + src/data/rssSource.ts）：FEEDS.en.world 追加
#    葡语（publico/observador/uol）、土耳其（aa/hurriyetdailynews/dailysabah）、东南亚
#    （bangkokpost/antara/thestar/cna/tuoitre/gmanetwork）稳定 RSS，两处保持一致。
#  - UI 层（src/app/globals.css）：SignalDeck 桌面图例改为顶部对齐+满高滚动（长列表不溢出）；
#    信息面板加 max-height+滚动（丰富站点数据不破版）；合并重复的 .sd-panel 静态规则。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov28_$TS.log

FILES=(
  src/lib/sourceGeo.ts
  src/data/rssSource.ts
  scripts/collect-articles.mjs
  src/app/globals.css
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "$f").bak-cov28-$TS" && echo "  备份 $f"
done

echo '=== 2. 推送改动文件到服务器 ==='
for f in "${FILES[@]}"; do
  scp "$LOCAL/$f" "$SRV:$REMOTE/$f" && echo "  推送 $f"
done

echo '=== 3. 采集新 RSS 源（最佳努力：网络不畅则沿用既有镜像，不阻断构建）==='
ssh "$SRV" "cd $REMOTE && timeout 600 node scripts/collect-articles.mjs" || echo "  ⚠ collect-articles 未全成功（可能部分源不可达），后续构建将沿用已有 data/articles.json 镜像。"

echo '=== 4. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 5. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 6. 冒烟验证（轮询等就绪）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov28 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "$f").bak-cov28-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
