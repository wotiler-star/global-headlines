#!/bin/bash
# deploy_cov36.sh — 修复「新接入源被新鲜度排名挤出，导致城市无信号」
# 根因：mergeMirror 按 publishedAt 降序后「每语言只留最新 800 条」。en 合并池远超 800，
#   而 inquirer(MNL)/capitalfm(NBO) 等更新较慢的源，文章比其他源旧几小时，
#   排不进前 800 → 整批被淘汰 → 该城市在地球仪上无信号（表现为「源明明可达却 0 条」）。
# 改动（1 文件）：
#   scripts/collect-articles.mjs   每语言上限 800 → 2000
# 副作用：articles.json 变大（每语言最多 2000），首页聚合有 15min TTL 缓存，影响可控。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov36_$TS.log

FILES=(
  scripts/collect-articles.mjs
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码 ==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\//_}").bak-cov36-$TS" && echo "  备份 $f"
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

echo '--- 4b. reload 反代 nginx（关键）---'
# 站点 80/443 由 ai-nav-nginx 统管并反代到 global-headlines:3000（共享 ainav-net）。
# nginx 在配置加载时解析上游主机名，容器 recreate 后换 IP，不 reload 会打到旧 IP 导致 502/404。
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

echo '--- 5b. 验证 MNL/NBO 信号是否点亮 ---'
ssh "$SRV" "docker exec global-headlines node -e \"
const a=JSON.parse(require('fs').readFileSync('/app/data/articles.json','utf8'));
const cnt=(s)=>a.filter(x=>(x.sourceUrl||'').includes(s)).length;
console.log('total='+a.length, 'inquirer(MNL)='+cnt('inquirer'), 'capitalfm.africa(NBO)='+cnt('capitalfm.africa'));
\" 2>/dev/null"

echo "=== cov36 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\//_}").bak-cov36-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
