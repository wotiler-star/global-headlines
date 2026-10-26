#!/bin/bash
# deploy_cov34.sh — 换可达 RSS 端点补地球信号（cov33 后续）
# 根因：58/131 个 feed 不可达（403/404/451/Cloudflare/无 RSS），对应分站无信号。
# 改动（3 文件）：
#   src/data/rssSource.ts          en.world 桶替换不可达端点 + 补回 MNL(inquirer.net)
#   scripts/collect-articles.mjs   与 rssSource.ts 完全同步（启动管线再生 articles.json 用）
#   src/lib/sourceGeo.ts           新增 6 个域名→城市映射（trthaber/IST myjoyonline/GHA
#                                    capitalfm.co.ke/NBO mosaiquefm.net/TUN middleeasteye.net/DXB
#                                    nezavisen.mk/SKP）
# 服务器侧实测恢复 9 城：IST GHA OSL CPH SKP MNL NBO TUN DXB
# 仍不可达（接受优雅无信号）：TLV SOF ALA BOM BKK HEL AMM CMB ISB LAH ULN ADD ASH
# 冒烟升级：八语首页 + 验证新信号域名是否进入 articles.json。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov34_$TS.log

FILES=(
  src/data/rssSource.ts
  scripts/collect-articles.mjs
  src/lib/sourceGeo.ts
)

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  if ssh "$SRV" "[ -f $REMOTE/$f ]"; then
    ssh "$SRV" "cp $REMOTE/$f /root/gh_archive/$(basename "${f//[\/\[]/_}").bak-cov34-$TS" && echo "  备份 $f"
  else
    echo "  （新文件，无需备份）$f"
  fi
done

echo '=== 2. 推送修复文件到服务器==='
for f in "${FILES[@]}"; do
  scp "$LOCAL/$f" "$SRV:$REMOTE/$f" && echo "  推送 $f"
done

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务（启动管线用新 FEEDS 再生 articles.json）==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 等启动管线完成（约 3 分钟）==='
for i in $(seq 1 30); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo '--- 5a. 兜底修复卷内数据（幂等，cov33 引入）---'
ssh "$SRV" "docker exec global-headlines node /app/scripts/repair-body.mjs" 2>&1 | grep -vE "WARNING|post-quantum|vulnerable|upgraded|Experimental|trace-warnings" || true

echo '--- 5b. 验证新信号域名是否进入 articles.json（按 sourceUrl 域名计数）---'
ssh "$SRV" "docker exec global-headlines node -e \"
const a=require('/app/data/articles.json');
const dom={ 'trthaber.com':0,'myjoyonline.com':0,'capitalfm.co.ke':0,'mosaiquefm.net':0,'middleeasteye.net':0,'nezavisen.mk':0,'inquirer.net':0 };
for(const x of a){ const u=x.sourceUrl||''; for(const d of Object.keys(dom)){ if(u.includes(d)) dom[d]++; } }
console.log('cov34 新信号域名命中:', JSON.stringify(dom));
\"" 2>/dev/null | grep -v "post-quantum\|store now\|upgraded"

echo '--- 5c. 八语首页 ---'
for L in zh en ja ko es fr pt tr; do
  H=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 90 http://127.0.0.1:8082/$L" 2>/dev/null | tail -1)
  echo "  [$L] 首页=$H"
done

echo "=== cov34 部署完成 ==="
BK=""
for f in "${FILES[@]}"; do BK="$BK /root/gh_archive/$(basename "${f//[\/\[]/_}").bak-cov34-$TS:$REMOTE/$f"; done
echo "回滚：ssh $SRV 'for p in $BK; do src=\${p%%:*}; dst=\${p##*:}; [ -f \$src ] && cp \$src \$dst; done && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
