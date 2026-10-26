#!/bin/bash
# deploy_cov35.sh — 性能根治（应用层，无外部反代可配）
# 根因：容器直接发布 80/443/8082，无 nginx 反代；首页 force-dynamic 每次重渲染，
#   而 rankRelated 的语料分词在「每 locale 首次」文章页冷渲染约 50s。
# 改动（2 文件）：
#   src/app/[locale]/page.tsx        ALL_ARTICLES_TTL 90s → 15min
#   src/data/newsSource.ts           _articlesCache 2min → 10min；getRelated 加按文章 id 缓存(30min)
# 启动预热：重启后主动请求八语首页 + 每语一篇真实文章页，把冷渲染成本（含分词语料构建）
#   在部署阶段一次性消化，真实用户永不等冷。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov35_$TS.log

FILES=(
  "src/app/[locale]/page.tsx"
  src/data/newsSource.ts
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码 ==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//[\/\[]/_}").bak-cov35-$TS" && echo "  备份 $f"
  else
    echo "  （新文件）$f"
  fi
done

echo '=== 2. 推送文件 ==='
for f in "${FILES[@]}"; do
  scp "$LOCAL/$f" "$SRV:$REMOTE/$f" && echo "  推送 $f"
done

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 等启动管线完成 ==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '--- 5a. 兜底修复卷内数据（幂等，cov33 引入）---'
ssh "$SRV" "docker exec global-headlines node /app/scripts/repair-body.mjs" 2>&1 | grep -vE "WARNING|post-quantum|vulnerable|upgraded|Experimental|trace-warnings" || true

echo '--- 5b. 启动预热：八语首页 + 每语一篇真实文章页（消化冷渲染）---'
for L in zh en ja ko es fr pt tr; do
  H=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code} t=%{time_total}' -m 120 http://127.0.0.1:8082/$L" 2>/dev/null | tail -1)
  AID=$(ssh "$SRV" "curl -s -m 120 http://127.0.0.1:8082/$L | grep -oE 'href=\"/$L/article/[^\"]+\"' | head -1 | sed 's/href=\"//;s/\"//'" 2>/dev/null | tail -1)
  if [ -n "$AID" ]; then
    A=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code} t=%{time_total}' -m 180 http://127.0.0.1:8082$AID" 2>/dev/null | tail -1)
    echo "  [$L] 首页=$H 文章页($AID)=$A"
  else
    echo "  [$L] 首页=$H （无文章链接）"
  fi
done

echo '--- 5c. 预热后再测一次冷渲染是否已被消化（二次访问应 <5s）---'
for L in zh en ko; do
  AID=$(ssh "$SRV" "curl -s -m 120 http://127.0.0.1:8082/$L | grep -oE 'href=\"/$L/article/[^\"]+\"' | head -1 | sed 's/href=\"//;s/\"//'" 2>/dev/null | tail -1)
  A=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code} t=%{time_total}' -m 120 http://127.0.0.1:8082$AID" 2>/dev/null | tail -1)
  echo "  [$L] 二次文章页=$A"
done

echo "=== cov35 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//[\/\[]/_}").bak-cov35-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
