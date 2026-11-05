#!/bin/bash
# deploy_cov41.sh — starteday 全面品牌升级（BRAND SYSTEM v1）
#
# 改动总览：
#   品牌名     8 语种 siteName/heroTitle/homeTitle/footer/tagline 统一为 starteday
#   视觉系统   CSS 变量换晨曦橙；20 处遗留头条红 #f04142 收敛到 --brand-solid
#   品牌资产   BrandMark/BrandWordmark 组件 + icon.svg + PWA PNG + favicon.ico + OG 卡
#   元数据     title/OG/JSON-LD/RSS/manifest/SW 缓存/采集 UA/静态 fallback 全量同步
# 不影响：docker 服务名 global-headlines、数据卷 gh-data、DB 文件名（改了会丢数据）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov41_$TS.log

FILES=(
  package.json
  package-lock.json
  public/icon.svg
  public/index.html
  public/manifest.webmanifest
  public/sw.js
  public/original/CREDITS.json
  public/original/tech-agents-fig1.svg
  public/icons/icon-192.png
  public/icons/icon-512.png
  public/icons/icon-maskable-512.png
  public/brand/og-cover.png
  public/brand/starteday-lockup.svg
  scripts/collect-articles.mjs
  scripts/gen-rss.mjs
  "src/app/[locale]/layout.tsx"
  "src/app/[locale]/page.tsx"
  "src/app/[locale]/search/page.tsx"
  src/app/favicon.ico
  src/app/globals.css
  src/app/not-found.tsx
  src/components/AdSlot.tsx
  src/components/DecodeTitle.tsx
  src/components/Footer.tsx
  src/components/Header.tsx
  src/components/HeroHead.tsx
  src/components/LeftRail.tsx
  src/components/MemberPanel.tsx
  src/components/ThemeToggle.tsx
  src/components/BrandMark.tsx
  src/lib/brand.ts
  src/data/rssSource.ts
  src/i18n/dictionaries.ts
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"
echo "文件数: ${#FILES[@]}"

echo '=== 1. 备份线上源码 + 创建新资源目录 ==='
ssh "$SRV" "mkdir -p /root/gh_archive $REMOTE/public/icons $REMOTE/public/brand"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f '$REMOTE/$f' ]"; then
    ssh "$SRV" "cp '$REMOTE/$f' '/root/gh_archive/$(basename "${f//\//_}").bak-cov41-$TS'" && echo "  备份 $f"
  else
    echo "  （新文件）$f"
  fi
done

echo '=== 2. 推送文件 ==='
# 新版 scp 默认走 SFTP：远程路径是字面量，不能再包一层单引号（会被当成文件名的一部分）
for f in "${FILES[@]}"; do
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then
    echo "  推送失败: $f"
    exit 1
  fi
  echo "  推送 $f"
done

echo '=== 3. 构建镜像（真实门槛：容器内 next build 类型检查）==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -60 "$LOG"; exit 1; }

echo '=== 4. 重启 + reload 反代 nginx ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -2 || echo "  （nginx reload 失败，需人工检查）"

echo '=== 5. 等启动管线完成 ==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '=== 6. 八语种 <title> / 品牌可见性抽检 ==='
for L in zh en ja ko es fr pt tr; do
  T=$(ssh "$SRV" "curl -s -m 60 http://127.0.0.1:8082/$L | grep -o '<title>[^<]*</title>' | head -1" 2>/dev/null | tail -1)
  N=$(ssh "$SRV" "curl -s -m 60 http://127.0.0.1:8082/$L | grep -o 'starteday' | wc -l" 2>/dev/null | tail -1)
  OLD=$(ssh "$SRV" "curl -s -m 60 http://127.0.0.1:8082/$L | grep -coE '全球头条|Global Headlines|グローバルヘッドライン'" 2>/dev/null | tail -1)
  echo "  [$L] $T  starteday×$N  旧品牌残留=$OLD"
done

echo '=== 7. 品牌资源可达性 ==='
for U in /manifest.webmanifest /icon.svg /favicon.ico /icons/icon-192.png /icons/icon-512.png /icons/icon-maskable-512.png /brand/og-cover.png /brand/starteday-lockup.svg; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $U -> %{http_code} (%{size_download} B)\n' -m 20 http://127.0.0.1:8082$U" 2>/dev/null | tail -1
done

echo '=== 8. RSS / 结构化数据 ==='
ssh "$SRV" "curl -s -m 20 http://127.0.0.1:8082/rss.xml | grep -o '<title>[^<]*</title>' | head -2" 2>/dev/null | tail -2
ssh "$SRV" "curl -s -m 20 http://127.0.0.1:8082/zh | grep -o '\"name\":\"starteday\"' | head -2" 2>/dev/null | tail -2

echo "=== cov41 部署完成（构建日志 $LOG）==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\//_}").bak-cov41-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
