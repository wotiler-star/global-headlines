#!/bin/bash
# deploy_cov44.sh — 站点内容重置：只保留今天的 3 篇原创策展稿（中英双语共 6 条数据）
#
# 用户指令：「除了今天的新的三篇文章，其余的文章全部删掉」
# 保留对象：data/original/premium-2026-11.json 的 3 个主题（安提瓜峰会 / 乌镇开源 / 进博会 APEC）
# 清理对象：articles.json 其余 2565 篇 + SQLite articles 表 10 万行历史数据
# 防回流：collect-articles.mjs 加 data/.freeze 开关；禁用内置示例稿兜底
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov44_$TS.log
BAK=/root/gh_archive

echo "=== 1. 备份（回滚依据）==="
ssh "$SRV" "mkdir -p $BAK"
ssh "$SRV" "docker cp global-headlines:/app/data/articles.json $BAK/articles.json.bak-cov44-$TS" && echo "  备份 articles.json"
ssh "$SRV" "docker cp global-headlines:/app/data/global-headlines.sqlite $BAK/global-headlines.sqlite.bak-cov44-$TS" && echo "  备份 SQLite"
for f in scripts/collect-articles.mjs src/data/news.ts; do
  ssh "$SRV" "cp $REMOTE/$f $BAK/$(basename "${f//\//_}").bak-cov44-$TS" && echo "  备份 $f"
done
echo "  本地快照: $LOCAL/current_articles.json"

echo "=== 2. 推送改动（SFTP 路径不带引号）==="
for f in scripts/reset-to-editorial.mjs scripts/collect-articles.mjs src/data/news.ts; do
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then echo "  推送失败: $f"; exit 1; fi
  echo "  推送 $f"
done
# 构建期也要跳过采集：宿主机项目目录放一份 .freeze（会被 COPY . . 打进镜像）
ssh "$SRV" "mkdir -p $REMOTE/data && printf 'cov44: content frozen\n' > $REMOTE/data/.freeze"
echo "  已写 $REMOTE/data/.freeze"

echo "=== 3. 旧容器执行首次重置（清存量 + 写 volume 内 .freeze）==="
ssh "$SRV" "docker cp $REMOTE/scripts/reset-to-editorial.mjs global-headlines:/app/scripts/reset-to-editorial.mjs && docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]|Error" | tail -8 || true

echo "=== 4. 重建镜像 + 重启（禁用示例稿 / 冻结开关进入镜像）==="
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -60 "$LOG"; exit 1; }
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -2
sleep 10
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -1 || true
for i in $(seq 1 20); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo "=== 5. 启动管线后二次重置（清掉 seed-db 可能回灌的行，幂等）==="
ssh "$SRV" "docker cp $REMOTE/scripts/reset-to-editorial.mjs global-headlines:/app/scripts/reset-to-editorial.mjs && docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]|Error" | tail -8 || true
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\] wrote" | tail -10 || true

echo "=== 6. 终态实证 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
console.log('  articles.json 条数:',d.length);
console.log('  保留 id:',JSON.stringify(d.map(a=>a.id)));
console.log('  freeze 文件存在:',fs.existsSync('data/.freeze'));
\"" 2>/dev/null | tail -4
ssh "$SRV" "docker exec global-headlines node scripts/diag_cov43.mjs" 2>/dev/null | grep "deleted=0 行数" | tail -1 || true
for L in zh en ja ko es fr pt tr; do
  ssh "$SRV" "printf '  [%s] ' $L; curl -s -o /tmp/f_\$L.html -w '首页=%{http_code} ' -m 60 http://127.0.0.1:8082/$L; curl -s -o /dev/null -w 'RSS=%{http_code}\n' -m 20 http://127.0.0.1:8082/$L/rss.xml" 2>/dev/null | tail -1
done
for U in /zh/article/rss-orig-chogm-2026-11 /en/article/rss-orig-chogm-2026-11-en /zh/article/rss-bnf7qm; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $U -> %{http_code}\n' -m 30 http://127.0.0.1:8082$U" 2>/dev/null | tail -1
done
echo "=== 7. 冻结日志 ==="
ssh "$SRV" "docker logs --tail 300 global-headlines 2>&1 | grep -E '内容冻结' | tail -2" 2>/dev/null | tail -2 || true

echo "=== cov44 完成（日志 $LOG）==="
echo "恢复自动采集：ssh $SRV 'docker exec global-headlines rm /app/data/.freeze; rm $REMOTE/data/.freeze'"
echo "回滚：ssh $SRV \"docker cp $BAK/articles.json.bak-cov44-$TS global-headlines:/app/data/articles.json && docker cp $BAK/global-headlines.sqlite.bak-cov44-$TS global-headlines:/app/data/global-headlines.sqlite && cp $BAK/collect-articles.mjs.bak-cov44-$TS $REMOTE/scripts/collect-articles.mjs && cp $BAK/news.ts.bak-cov44-$TS $REMOTE/src/data/news.ts && rm -f $REMOTE/data/.freeze && docker exec global-headlines rm -f /app/data/.freeze && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines\""
