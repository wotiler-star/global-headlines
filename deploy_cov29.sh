#!/bin/bash
# cov29 部署：① 新增 pt/tr 真实 UI 界面语言（字典+locale 注册）② 更多非洲/中东分站
#   （DXB/TLV/DOH/AMM + NBO/CPT/ADD/TUN/GHA，含 9 个真实 RSS）③ 性能再榨取
#   （首页地球聚合加模块级 90s TTL 记忆，最贵操作从每请求降到每 90s 一次）。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov29_$TS.log

FILES=(
  src/i18n/config.ts
  src/i18n/dictionaries.ts
  src/lib/sourceGeo.ts
  src/data/rssSource.ts
  scripts/collect-articles.mjs
  src/app/\[locale\]/page.tsx
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\[/}").bak-cov29-$TS" && echo "  备份 $f"
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

echo '=== 6. 冒烟验证（轮询等就绪，覆盖 zh/en/pt/tr 四语）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  PT=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/pt" 2>/dev/null | tail -1)
  TR=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/tr" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN PT=$PT TR=$TR"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ] && [ "$PT" = "200" ] && [ "$TR" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov29 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\[/}").bak-cov29-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
