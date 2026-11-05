#!/bin/bash
# deploy_cov45b.sh — 修复：data/original/ 位于 Docker volume，scp 到宿主机项目目录不生效
# 必须 docker cp 进容器 /app/data/original/，再重置内容库。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"

echo "=== 1. volume 内原创稿目录现状 ==="
ssh "$SRV" "docker exec global-headlines ls -1 /app/data/original/"

echo "=== 2. 新稿送入 volume（运行时真正读取的位置）==="
ssh "$SRV" "docker cp $REMOTE/data/original/premium-2026-11.json global-headlines:/app/data/original/premium-2026-11.json"
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/original/premium-2026-11.json','utf8'));
console.log('  volume 内原创稿:',d.length,'篇',JSON.stringify(d.map(a=>a.id)));
\"" 2>/dev/null | tail -2

echo "=== 3. 重置（清旧 6 条，只留新 3 篇）==="
ssh "$SRV" "docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true

echo "=== 4. 重启容器（清 SSR 缓存 + 让 merge-originals 同步新稿）==="
ssh "$SRV" "cd $REMOTE && docker compose restart global-headlines" 2>&1 | tail -2
sleep 12
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -1 || true
for i in $(seq 1 20); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo "=== 5. 幂等重置 + 重建 RSS ==="
ssh "$SRV" "docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\] wrote" | tail -10 || true

echo "=== 6. 终态实证 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
console.log('  文章数:',d.length);
console.log('  id:',JSON.stringify(d.map(a=>a.id)));
console.log('  配图数:',JSON.stringify(d.map(a=>(a.images||[]).length)));
console.log('  .freeze:',fs.existsSync('data/.freeze'));
\"" 2>/dev/null | tail -5
for U in /zh/article/rss-orig-spatial-glasses-2026-11 /zh/article/rss-orig-edge-ai-chip-2026-11 /zh/article/rss-orig-car-ai-box-2026-11 /zh/article/rss-orig-chogm-2026-11; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $U -> %{http_code}\n' -m 30 http://127.0.0.1:8082$U" 2>/dev/null | tail -1
done
echo "  freeze 文件（宿主机 / 容器）:"
ssh "$SRV" "test -e $REMOTE/data/.freeze && echo '    宿主机仍存在' || echo '    宿主机已删'; docker exec global-headlines test -e /app/data/.freeze && echo '    容器内仍存在' || echo '    容器内已删'" 2>/dev/null
echo "=== cov45b 完成 ==="
