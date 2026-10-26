#!/bin/bash
# deploy_cov32c.sh — cov32 最终部署：修复 node_modules 损坏后本地 tsc 全绿，暴露并修复了
# cov29 引入的一批真实类型错误（此前被损坏的 node_modules TS2307 洪水 + 输出截断掩盖）。
# 本脚本推送全部修复文件（7 个）：
#   src/data/news.ts                 pt/tr 补全（4 模板 + sources + 42 concepts + 8 videoConcepts）
#   src/components/CurrencyConverter.tsx  pt/tr 界面文案
#   src/data/videoSource.ts          pt/tr 检索词
#   src/i18n/config.ts               categories 增加 culture（cov32 culture 分类的类型基础）
#   src/i18n/dictionaries.ts         8 语言 categories.culture 标签
#   src/data/rssSource.ts            FR24 补 culture 映射
#   src/lib/sourceGeo.ts             移除两处重复键（dailysabah.com / "South Africa"）
# 其余文件（SignalDeck/globals.css/page.tsx/Lazy×2/layout.tsx/collect-articles/next.config）
# 已由 deploy_cov32.sh 与 deploy_cov32b.sh 推送且本地未再改动。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov32c_$TS.log

FILES=(
  src/data/news.ts
  src/components/CurrencyConverter.tsx
  src/data/videoSource.ts
  src/i18n/config.ts
  src/i18n/dictionaries.ts
  src/data/rssSource.ts
  src/lib/sourceGeo.ts
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "$f").bak-cov32c-$TS" && echo "  备份 $f"
done

echo '=== 2. 推送修复文件到服务器==='
for f in "${FILES[@]}"; do
  scp "$LOCAL/$f" "$SRV:$REMOTE/$f" && echo "  推送 $f"
done

echo '=== 3. 采集新 RSS 源（最佳努力：网络不畅则沿用既有镜像，不阻断构建）==='
ssh "$SRV" "cd $REMOTE && timeout 600 node scripts/collect-articles.mjs" || echo "  ⚠ collect-articles 未全成功（可能部分源不可达），后续构建将沿用已有 data/articles.json 镜像。"

echo '=== 4. 构建镜像==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 5. 重启服务==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 6. 冒烟验证（轮询等就绪，覆盖 zh/en/pt/tr/es 五语）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  PT=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/pt" 2>/dev/null | tail -1)
  TR=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/tr" 2>/dev/null | tail -1)
  ES=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/es" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN PT=$PT TR=$TR ES=$ES"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ] && [ "$PT" = "200" ] && [ "$TR" = "200" ] && [ "$ES" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov32c 最终部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "$f").bak-cov32c-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
