#!/bin/bash
# deploy_cov33.sh — 修复「文章页 500（pickQuote 踩 undefined body）」
# 根因：gh-data 卷内 articles.json 有历史遗留的缺 body 条目（旧版采集器无兜底 /
#   rebuild-mirror.mjs 从无 body 列的 DB 重建）；运行进程 22:11 载入坏数据进模块缓存，
#   即使文件后被治愈也不重读 → 文章页持续 500，须重启 + 代码防御双管齐下。
# 改动（5 文件）：
#   src/app/[locale]/article/[id]/page.tsx   pickQuote/images/metadata 全部 undefined 防护
#   src/data/rssSource.ts                    loadJsonDb 读取时归一化补 body
#   scripts/collect-articles.mjs             mergeMirror 合并时归一化（镜像自愈）
#   scripts/rebuild-mirror.mjs               补 body 兜底（历史肇事脚本）
#   scripts/repair-body.mjs（新）             一次性修复脚本，幂等，部署后兜底跑一次
# 冒烟升级：五语首页 + 每语从首页抓一篇真实文章页验证 200。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov33_$TS.log

FILES=(
  "src/app/[locale]/article/[id]/page.tsx"
  src/data/rssSource.ts
  scripts/collect-articles.mjs
  scripts/rebuild-mirror.mjs
  scripts/repair-body.mjs
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用；新文件不存在则跳过）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\[/}").bak-cov33-$TS" && echo "  备份 $f"
  else
    echo "  （新文件，无需备份）$f"
  fi
done

echo '=== 2. 推送修复文件到服务器==='
for f in "${FILES[@]}"; do
  scp "$LOCAL/$f" "$SRV:$REMOTE/$f" && echo "  推送 $f"
done

echo '=== 3. 构建镜像（注：不再跑宿主采集器——卷内合并由容器启动管线负责，宿主侧曾静默失败）==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务（重启后模块缓存重载，治愈的 articles.json 生效）==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 等启动管线完成（seed/collect/merge/gen-rss 约 3 分钟）后兜底修复 + 冒烟==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '--- 5a. 兜底修复卷内数据（幂等）---'
ssh "$SRV" "docker exec global-headlines node /app/scripts/repair-body.mjs" 2>&1 | grep -vE "WARNING|post-quantum|vulnerable|upgraded|Experimental|trace-warnings" || true

echo '--- 5b. 五语首页 + 每语一篇真实文章页 ---'
for L in zh en pt tr es; do
  H=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 90 http://127.0.0.1:8082/$L" 2>/dev/null | tail -1)
  AID=$(ssh "$SRV" "curl -s -m 90 http://127.0.0.1:8082/$L | grep -oE 'href=\"/$L/article/[^\"]+\"' | head -1 | sed 's/href=\"//;s/\"//'" 2>/dev/null | tail -1)
  if [ -n "$AID" ]; then
    A=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 90 http://127.0.0.1:8082$AID" 2>/dev/null | tail -1)
  else
    A="(无文章链接)"
  fi
  echo "  [$L] 首页=$H 文章页($AID)=$A"
done

echo "=== cov33 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\[/}").bak-cov33-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
