#!/bin/bash
# deploy_cov37.sh — 复活 13 死城中可达的 5 城（SOF/BOM/BKK/ULN/ADD）
# 做法：服务器侧实测各城候选 RSS 端点，把不可达端点替换为实测 OK 的源，并补齐域名→城市映射。
# 新增端点（服务器实测条数）：
#   SOF  https://www.dnevnik.bg/rss/                  (30)  替换 404 的 novinite
#   BOM  https://www.livemint.com/rss/news            (35)  替换 NOITEMS 的 freepressjournal
#   BKK  https://www.prachachat.net/feed              (30)  替换 451 的 bangkokpost
#   BKK  https://www.matichon.co.th/feed              (50)  补充
#   ULN  https://ikon.mn/rss                          (30)  替换 404 的 ubpost
#   ADD  https://www.thereporterethiopia.com/feed/    (10)  替换 403 的 addisstandard
#   ADD  https://www.ethiopianmonitor.com/feed/       (10)  补充
# 仍不可达（接受优雅无信号）：TLV / HEL / AMM / CMB / ISB / LAH / ALA / ASH
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov37_$TS.log

FILES=(
  src/data/rssSource.ts
  scripts/collect-articles.mjs
  src/lib/sourceGeo.ts
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码 ==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\//_}").bak-cov37-$TS" && echo "  备份 $f"
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

echo '--- 5a. 启动预热：八语首页 + 每语一篇真实文章页（消化冷渲染）---'
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

echo '--- 5b. 验证 5 城信号是否点亮 ---'
# 容器 recreate 会清空 /tmp，故此处现场拷入再执行
scp "$LOCAL/check_cov37.mjs" "$SRV:/tmp/check_cov37.mjs" >/dev/null 2>&1
ssh "$SRV" "docker cp /tmp/check_cov37.mjs global-headlines:/tmp/check_cov37.mjs >/dev/null && docker exec global-headlines node /tmp/check_cov37.mjs 2>&1" | grep -vE "WARNING|post-quantum|vulnerable|upgraded" || true

echo "=== cov37 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\//_}").bak-cov37-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
