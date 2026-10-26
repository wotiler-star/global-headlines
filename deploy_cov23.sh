#!/bin/bash
# cov23 部署：采集管线健壮性修复（YNA 被限流事故）+ YNA 英文备份源
# 背景：韩文 YNA 站开始对服务器 ECONNRESET（限流），而 articles.json 镜像每次启动被
#       「本次新采」整体覆盖 → ICN 首尔站直接从首页/地球仪消失（DB 里 2909 条还在，但首页不读 DB）。
# 改动文件：
#   scripts/collect-articles.mjs（① fetchFeed 加 3 次退避重试 2s/5s；
#     ② 镜像改为合并写入（按 id 叠加 + 每语言 800 条上限 + 丢弃 14 天前），单源失败不再抹掉整个源；
#     ③ en.world 加 YNA 英文源 en.yna.co.kr 作 ICN 备份）
#   src/data/rssSource.ts（同步加 YNA 英文源）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov23_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/scripts/collect-articles.mjs /root/gh_archive/collect-articles.mjs.bak-cov23-$TS && cp $REMOTE/src/data/rssSource.ts /root/gh_archive/rssSource.ts.bak-cov23-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/scripts/collect-articles.mjs" "$SRV:$REMOTE/scripts/collect-articles.mjs"
scp "$LOCAL/src/data/rssSource.ts" "$SRV:$REMOTE/src/data/rssSource.ts"
scp "$LOCAL/scripts/rebuild-mirror.mjs" "$SRV:$REMOTE/scripts/rebuild-mirror.mjs"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务（入口链自动跑 collect-articles）==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证（轮询等就绪：重试逻辑会让 collect 变慢，约需 60-180s）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done

echo '=== 6. 从 DB 重建 articles.json 镜像（恢复被上次覆盖抹掉的 YNA 等内容；此后由合并逻辑维护）==='
ssh "$SRV" "docker exec global-headlines node /app/scripts/rebuild-mirror.mjs && docker exec global-headlines node /app/scripts/merge-originals.mjs" 2>&1 | grep -vE "WARNING|post-quantum|vulnerable|upgraded|Experimental|trace-warnings" | tail -4

echo '=== 7. 最终重启（rssSource 的镜像缓存是进程内一次性，重启让应用读到重建后的镜像；
   此次 collect 走合并逻辑，DB 重建的内容会被保留）==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines --force-recreate" 2>&1 | tail -2
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH"
  if [ "$ZH" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov23 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/collect-articles.mjs.bak-cov23-$TS $REMOTE/scripts/collect-articles.mjs && cp /root/gh_archive/rssSource.ts.bak-cov23-$TS $REMOTE/src/data/rssSource.ts && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
