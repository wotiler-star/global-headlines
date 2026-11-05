#!/bin/bash
# deploy_cov44b.sh — 修复内容重置后 SignalDeck 空数据水合崩溃
# peak 为 undefined 时读 peak.name 抛异常 → 整页 Application error。加 null 兜底后重建镜像。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov44b_$TS.log
F=src/components/SignalDeck.tsx

echo "=== 1. 备份 + 推送 ==="
ssh "$SRV" "cp $REMOTE/$F /root/gh_archive/SignalDeck.tsx.bak-cov44b-$TS"
if ! scp -q "$LOCAL/$F" "$SRV:$REMOTE/$F"; then echo "推送失败"; exit 1; fi
echo "  已推送 $F"

echo "=== 2. 重建 + 重启 ==="
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

echo "=== 3. 幂等重置（清掉启动管线回灌）+ 重建 RSS ==="
ssh "$SRV" "docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\] wrote" | tail -10 || true

echo "=== 4. 终态 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
console.log('  articles.json 条数:',d.length,'| freeze:',fs.existsSync('data/.freeze'));
\"" 2>/dev/null | tail -2
for L in zh en ja; do
  ssh "$SRV" "printf '  [%s] ' $L; curl -s -o /tmp/w_\$L.html -w '首页=%{http_code} ' -m 60 http://127.0.0.1:8082/$L; grep -o \"href=\\\"/\$L/article/[^\\\"]*\" /tmp/w_\$L.html | sort -u | wc -l" 2>/dev/null | tail -1
done
echo "=== cov44b 完成（日志 $LOG）==="
