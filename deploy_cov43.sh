#!/bin/bash
# deploy_cov43.sh — 清除「导读 == 全文正文」低质量摘要稿（用户确认：全部删除）
#
# 背景：文章页 LEAD 渲染 summary，正文渲染 body。命中稿件正文只有一段且与导读一字不差。
# 线上 9246 篇命中 6847 篇（74%），确认后全部删除，剩余 2399 篇。
# 两步：① 存量清理（articles.json + SQLite）② 采集器源头过滤（否则 2h 后定时采集会抓回）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov43_$TS.log
BAK=/root/gh_archive

echo "=== 1. 备份线上数据（回滚依据）==="
ssh "$SRV" "mkdir -p $BAK"
ssh "$SRV" "docker cp global-headlines:/app/data/articles.json $BAK/articles.json.bak-cov43-$TS" && echo "  备份 articles.json"
ssh "$SRV" "docker cp global-headlines:/app/data/global-headlines.sqlite $BAK/global-headlines.sqlite.bak-cov43-$TS" && echo "  备份 SQLite"
ssh "$SRV" "cp $REMOTE/scripts/collect-articles.mjs $BAK/collect-articles.mjs.bak-cov43-$TS" && echo "  备份采集器"
echo "  本地副本: $LOCAL/online_articles.json"

echo "=== 2. 推送脚本（SFTP 路径不带引号）==="
for f in scripts/lead-dup.mjs scripts/purge-lead-dup.mjs scripts/collect-articles.mjs; do
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then
    echo "  推送失败: $f"
    exit 1
  fi
  echo "  推送 $f"
done

echo "=== 3. 存量清理（在旧容器上执行，此时镜像尚未被新采集器重写）==="
ssh "$SRV" "docker cp $REMOTE/scripts/lead-dup.mjs global-headlines:/app/scripts/lead-dup.mjs && docker cp $REMOTE/scripts/purge-lead-dup.mjs global-headlines:/app/scripts/purge-lead-dup.mjs && docker exec global-headlines node scripts/purge-lead-dup.mjs" 2>&1 | grep -E "^\[purge\]|Error|error" | tail -12

echo "=== 4. 重建镜像（让源头过滤进入镜像，容器重建后仍生效）==="
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -60 "$LOG"; exit 1; }
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -2
sleep 10
ssh "$SRV" "docker exec ai-nav-nginx nginx -s reload" 2>&1 | tail -1 || true

echo "=== 5. 等待首页 200 ==="
for i in $(seq 1 20); do
  CODE=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  探测首页：ZH=$CODE"
  [ "$CODE" = "200" ] && break
  sleep 10
done

echo "=== 6. 清理结果实证 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
import { shouldPurge } from './scripts/lead-dup.mjs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
const h=d.filter(shouldPurge);
console.log('  剩余文章',d.length,'仍命中低质量',h.length);
console.log('  截图文章 rss-1rnn0ds 存在:',d.some(a=>a.id==='rss-1rnn0ds'));
\"" 2>/dev/null | tail -4
ssh "$SRV" "curl -s -o /dev/null -w '  被删文章详情页 -> %{http_code}\n' -m 20 http://127.0.0.1:8082/zh/article/rss-1rnn0ds" 2>/dev/null | tail -1
for L in zh en ja ko es fr pt tr; do
  ssh "$SRV" "printf '  [%s] ' $L; curl -s -o /tmp/h_$L.html -w '首页=%{http_code} %{size_download}B ' -m 60 http://127.0.0.1:8082/$L; curl -s -o /dev/null -w 'RSS=%{http_code}\n' -m 20 http://127.0.0.1:8082/$L/rss.xml" 2>/dev/null | tail -1
done
echo "=== 7. 采集器过滤日志 ==="
ssh "$SRV" "docker logs --tail 200 global-headlines 2>&1 | grep -E '过滤低质量|\[collect\] 写入 data/articles' | tail -4" 2>/dev/null | tail -4

echo "=== cov43 完成（构建日志 $LOG）==="
echo "回滚：ssh $SRV \"docker cp $BAK/articles.json.bak-cov43-$TS global-headlines:/app/data/articles.json && docker cp $BAK/global-headlines.sqlite.bak-cov43-$TS global-headlines:/app/data/global-headlines.sqlite && cp $BAK/collect-articles.mjs.bak-cov43-$TS $REMOTE/scripts/collect-articles.mjs && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines\""
