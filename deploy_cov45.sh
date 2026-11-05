#!/bin/bash
# deploy_cov45.sh — 恢复自动内容更新 + 上线 3 篇合规原创稿（含封面与配图）
#
# 用户要求：删掉两个 .freeze；每次只出 3 篇高质量实时热点原创文章；
#           严禁政治/军事/宗教/种族/儿童；二次改编创作；有标题、封面、配图。
# 实现：采集器改为精选模式（不再抓 131 个 RSS 源），内容由编辑管线写入
#       data/original/*.json；定时任务每天生成 3 篇 + 9 张图并部署。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov45_$TS.log
BAK=/root/gh_archive

IMAGES=(
  spatial-glasses-cover spatial-glasses-fig1 spatial-glasses-fig2
  edge-ai-chip-cover edge-ai-chip-fig1 edge-ai-chip-fig2
  car-ai-cover car-ai-fig1 car-ai-fig2
)
FILES=(
  data/original/premium-2026-11.json
  public/original/CREDITS.json
  scripts/collect-articles.mjs
  scripts/reset-to-editorial.mjs
)

echo "=== 1. 备份 ==="
ssh "$SRV" "mkdir -p $BAK"
ssh "$SRV" "docker cp global-headlines:/app/data/articles.json $BAK/articles.json.bak-cov45-$TS" && echo "  备份 articles.json"
ssh "$SRV" "docker cp global-headlines:/app/data/global-headlines.sqlite $BAK/global-headlines.sqlite.bak-cov45-$TS" && echo "  备份 SQLite"
for f in "${FILES[@]}"; do
  ssh "$SRV" "cp '$REMOTE/$f' '$BAK/$(basename "${f//\//_}").bak-cov45-$TS'" 2>/dev/null || true
done

echo "=== 2. 推送 3 篇文章 + 9 张图 + 脚本 ==="
for f in "${FILES[@]}"; do
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then echo "  推送失败: $f"; exit 1; fi
  echo "  推送 $f"
done
for n in "${IMAGES[@]}"; do
  if ! scp -q "$LOCAL/public/original/$n.webp" "$SRV:$REMOTE/public/original/$n.webp"; then echo "  推送失败: $n.webp"; exit 1; fi
  echo "  推送 $n.webp"
done

echo "=== 3. 删除两个 .freeze（恢复自动内容更新）==="
ssh "$SRV" "rm -f $REMOTE/data/.freeze && echo '  已删宿主机 .freeze'"
ssh "$SRV" "docker exec global-headlines rm -f /app/data/.freeze && echo '  已删容器内 .freeze'"

echo "=== 4. 容器内重置（清掉旧 6 条，只留新 3 篇原创稿）==="
ssh "$SRV" "docker cp $REMOTE/scripts/reset-to-editorial.mjs global-headlines:/app/scripts/reset-to-editorial.mjs && docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]|Error" | tail -6 || true

echo "=== 5. 重建镜像 + 重启 ==="
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

echo "=== 6. 启动管线后幂等重置 + 重建 RSS ==="
ssh "$SRV" "docker cp $REMOTE/scripts/reset-to-editorial.mjs global-headlines:/app/scripts/reset-to-editorial.mjs && docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\] wrote" | tail -10 || true

echo "=== 7. 终态实证 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
console.log('  文章数:',d.length,'| id:',JSON.stringify(d.map(a=>a.id)));
console.log('  每篇配图数:',JSON.stringify(d.map(a=>(a.images||[]).length)));
console.log('  .freeze 存在:',fs.existsSync('data/.freeze'));
\"" 2>/dev/null | tail -4
for U in /original/spatial-glasses-cover.webp /original/edge-ai-chip-cover.webp /original/car-ai-cover.webp /zh/article/rss-orig-spatial-glasses-2026-11 /zh/article/rss-orig-edge-ai-chip-2026-11 /zh/article/rss-orig-car-ai-box-2026-11 /zh/article/rss-orig-chogm-2026-11; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $U -> %{http_code}\n' -m 30 http://127.0.0.1:8082$U" 2>/dev/null | tail -1
done
for L in zh en ja; do
  ssh "$SRV" "printf '  [%s] ' $L; curl -s -o /dev/null -w '首页=%{http_code} ' -m 60 http://127.0.0.1:8082/$L; curl -s -o /dev/null -w 'RSS=%{http_code}\n' -m 20 http://127.0.0.1:8082/$L/rss.xml" 2>/dev/null | tail -1
done
echo "=== cov45 完成（日志 $LOG）==="
