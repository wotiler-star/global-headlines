#!/bin/bash
# deploy_cov42.sh — 品牌升级收尾：补齐 PWA / 错误页 / 八语种 RSS
#
# 审计发现：gen-rss.mjs 硬编码 6 语种，/pt/rss.xml 与 /tr/rss.xml 长期 404
#           （pt 有 40 篇、tr 有 130 篇数据，纯生成逻辑漏语言）。改为从 i18n config.ts 解析。
# 另补：viewport themeColor、apple-touch-icon、metadata icons、SW 缓存 v2、404 品牌落款、
#       清理 21 行源码注释里的竞品指向。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov42_$TS.log

FILES=(
  scripts/gen-rss.mjs
  "src/app/[locale]/layout.tsx"
  "src/app/[locale]/search/page.tsx"
  src/app/not-found.tsx
  src/app/globals.css
  src/app/favicon.ico
  public/sw.js
  public/apple-touch-icon.png
  public/icons/icon-192.png
  public/icons/icon-512.png
  public/icons/icon-maskable-512.png
  public/brand/og-cover.png
  src/components/ArticleAuthorCard.tsx
  src/components/ArticleRail.tsx
  src/components/CommentSection.tsx
  src/components/InfiniteFeed.tsx
  src/components/LeftRail.tsx
  src/components/NewsCard.tsx
  src/components/SearchHotBoard.tsx
  src/components/SearchResults.tsx
  src/components/TodayBrief.tsx
  src/components/TopBarExtras.tsx
  src/components/VideoModal.tsx
)

echo "本地项目: $LOCAL / 文件数: ${#FILES[@]}"
echo '=== 1. 备份 + 推送（SFTP 路径不带引号，失败即退出）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  ssh "$SRV" "[ -f '$REMOTE/$f' ] && cp '$REMOTE/$f' '/root/gh_archive/$(basename "${f//\//_}").bak-cov42-$TS'" 2>/dev/null || true
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then
    echo "  推送失败: $f"
    exit 1
  fi
  echo "  推送 $f"
done

echo '=== 2. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -60 "$LOG"; exit 1; }

echo '=== 3. 重启 + reload 反代 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -2
sleep 8
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -1 || true
for i in $(seq 1 20); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '=== 4. 容器内显式重跑 RSS 生成（8 语种）==='
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\]" | tail -12

echo '=== 5. 八语种 RSS + 新资源状态 ==='
for L in zh en ja ko es fr pt tr; do
  ssh "$SRV" "curl -s -o /dev/null -w '  /$L/rss.xml -> %{http_code} (%{size_download} B)\n' -m 20 http://127.0.0.1:8082/$L/rss.xml" 2>/dev/null | tail -1
done
for U in /rss.xml /apple-touch-icon.png /sw.js /icon.svg; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $U -> %{http_code} (%{size_download} B)\n' -m 20 http://127.0.0.1:8082$U" 2>/dev/null | tail -1
done
echo '=== 6. 页头品牌 meta ==='
ssh "$SRV" "curl -s -m 30 http://127.0.0.1:8082/zh | grep -oE '<meta name=\"theme-color\"[^>]*>|rel=\"apple-touch-icon\"[^>]*>' | head -4" 2>/dev/null | tail -4

echo "=== cov42 完成（日志 $LOG）==="
