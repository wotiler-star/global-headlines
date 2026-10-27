#!/bin/bash
# deploy_cov39.sh — 首屏瘦身：SSR 不再下发跨语种全量数据集，改按需拉取
# 改动：
#   src/app/api/all-articles/route.ts  (新增) 跨语种全量文章(body 剥离)，供点地球地区(?src=)按需拉取
#   src/components/InfiniteFeed.tsx     ?src= 生效且 prop 为空时 fetch /api/all-articles
#   src/app/[locale]/page.tsx          不再下发 allArticles(原 slimAll，~5.7MB RSC) 给首页
# 预期：首屏 HTML 8-9MB -> ~3MB（仍保留当前语种文章以保 SEO）。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov39_$TS.log

FILES=(
  src/app/api/all-articles/route.ts
  src/components/InfiniteFeed.tsx
  src/app/\[locale\]/page.tsx
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码 ==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//\//_}").bak-cov39-$TS" && echo "  备份 $f"
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

echo '--- 4b. reload 反代 nginx（容器换 IP 后必须 reload）---'
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -2 || echo "  （nginx reload 失败，需人工检查）"

echo '=== 5. 等启动管线完成 ==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '=== 6. 首屏 HTML 体积对比（源站）==='
ssh "$SRV" "curl -s -o /tmp/zh39.html -w 'html_bytes=%{size_download}\n' http://127.0.0.1:8082/zh; echo \"flight/render 块（MB）:\"; python3 - <<'PY'
import re
s=open('/tmp/zh39.html',encoding='utf8',errors='replace').read()
tot=sum(len(m.group(1)) for m in re.finditer(r'self.__next_f\.push\((.*?)\);', s, re.S))
print('  flight payload: %.2f MB'%(tot/1048576))
print('  html total: %.2f MB'%(len(s)/1048576))
PY"
echo '=== 6b. /api/all-articles 可用性 ==='
ssh "$SRV" "curl -s -o /dev/null -w 'api=%{http_code} size=%{size_download}B\n' http://127.0.0.1:8082/api/all-articles"

echo '=== cov39 部署完成 ==='
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//\//_}").bak-cov39-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
