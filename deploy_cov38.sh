#!/bin/bash
# deploy_cov38.sh — 内容新鲜度优化（定时刷新的配套代码改动）
# 背景：采集器只在容器启动时跑一次，容器不重启 → 新闻冻结在启动时刻。
# 已在宿主机挂 cron：/opt/starteday/refresh.sh（每 2h 重跑采集+预热）、warm.sh（每 10min 预热）。
# 但仅有定时采集不够——应用进程把 articles.json 读进模块内存后永不重读，新数据不生效。
# 改动：
#   src/data/rssSource.ts        loadJsonDb 加 10min TTL，定期重读 articles.json（读失败保留旧数据）
#   scripts/collect-articles.mjs normalizeArticle 钳制「未来 publishedAt」到当前时间
#     （部分源 pubDate 时区偏移被解析成未来时刻，会污染首页最近 1h/24h 信号分布）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov38_$TS.log

FILES=(
  src/data/rssSource.ts
  scripts/collect-articles.mjs
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码 ==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\//_}").bak-cov38-$TS" && echo "  备份 $f"
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

echo '--- 4b. reload 反代 nginx（关键：容器换 IP 后必须 reload）---'
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -2 || echo "  （nginx reload 失败，需人工检查）"

echo '=== 5. 等启动管线完成 ==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '--- 5a. 启动预热：八语首页 + 每语一篇真实文章页 ---'
for L in zh en ja ko es fr pt tr; do
  H=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code} t=%{time_total}' -m 120 http://127.0.0.1:8082/$L" 2>/dev/null | tail -1)
  AID=$(ssh "$SRV" "curl -s -m 120 http://127.0.0.1:8082/$L | grep -oE 'href=\"/$L/article/[^\"]+\"' | head -1 | sed 's/href=\"//;s/\"//'" 2>/dev/null | tail -1)
  if [ -n "$AID" ]; then
    A=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code} t=%{time_total}' -m 180 http://127.0.0.1:8082$AID" 2>/dev/null | tail -1)
    echo "  [$L] 首页=$H 文章页=$A"
  else
    echo "  [$L] 首页=$H （无文章链接）"
  fi
done

echo '--- 5b. 新鲜度与信号校验 ---'
scp "$LOCAL/check_fresh.mjs" "$SRV:/tmp/check_fresh.mjs" >/dev/null 2>&1
ssh "$SRV" "docker cp /tmp/check_fresh.mjs global-headlines:/tmp/check_fresh.mjs >/dev/null && docker exec global-headlines node /tmp/check_fresh.mjs 2>&1" | grep -vE "WARNING|post-quantum|vulnerable|upgraded" || true
scp "$LOCAL/check_cov37.mjs" "$SRV:/tmp/check_cov37.mjs" >/dev/null 2>&1
ssh "$SRV" "docker cp /tmp/check_cov37.mjs global-headlines:/tmp/check_cov37.mjs >/dev/null && docker exec global-headlines node /tmp/check_cov37.mjs 2>&1" | grep -vE "WARNING|post-quantum|vulnerable|upgraded" || true

echo "=== cov38 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\//_}").bak-cov38-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
