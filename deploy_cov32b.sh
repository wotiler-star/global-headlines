#!/bin/bash
# deploy_cov32b.sh — cov32 补推：cov27–cov31 的改动从未部署到服务器（服务器停在 cov26），
# 本次一并补齐，使服务器与本地工作区完全一致（md5 全量比对确认仅差这些文件）。
# 文件清单（8 个）：
#   src/components/SignalDeck.tsx        cov27 镜头补转修复
#   src/app/globals.css                  cov28 图例/面板响应式
#   src/i18n/config.ts                   cov29 pt/tr 注册（8 locales）
#   src/i18n/dictionaries.ts             cov29 pt/tr 完整字典
#   src/app/[locale]/page.tsx            cov29 TTL 聚合 + cov30/31 Lazy 引用
#   src/components/SignalDeckLazy.tsx    cov30 新增（ssr:false 动态化）
#   src/components/HomeFeedRouterLazy.tsx cov31 新增（保留 SSR 代码分割）
#   src/app/[locale]/layout.tsx          cov17 suppressHydrationWarning（修复了 JSX 注释语法错误）
# 另 4 个 cov32 文件（sourceGeo/rssSource/collect-articles/next.config）已由 deploy_cov32.sh 推送。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov32b_$TS.log

FILES=(
  src/components/SignalDeck.tsx
  src/app/globals.css
  src/i18n/config.ts
  src/i18n/dictionaries.ts
  "src/app/[locale]/page.tsx"
  src/components/SignalDeckLazy.tsx
  src/components/HomeFeedRouterLazy.tsx
  "src/app/[locale]/layout.tsx"
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用；新文件不存在则跳过）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\[/}").bak-cov32b-$TS" && echo "  备份 $f"
  else
    echo "  （新文件，无需备份）$f"
  fi
done

echo '=== 2. 推送改动文件到服务器==='
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

echo "=== cov32b 补推部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\[/}").bak-cov32b-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
