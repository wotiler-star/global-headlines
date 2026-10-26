#!/bin/bash
# cov19 部署：地球仪新增 7 个主要大国可交互分站（俄罗斯/加拿大/沙特/巴西/印度/南非/澳大利亚）
# 改动文件：
#   src/lib/sourceGeo.ts（+7 城市 CITIES / +8 域名映射含 bbc.com 补 LON / +7 国家映射）
#   src/data/rssSource.ts（en.world +7 个英文 feed）
#   scripts/collect-articles.mjs（同步 +7 feed；容器启动时采集入库，INSERT OR REPLACE 幂等）
# 注意：容器重启时入口链会跑 collect-articles.mjs 拉取新 feed 入库，
#       重启后需等待约 1-2 分钟采集完成，首页地球图例才会出现新分站。
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov19_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/lib/sourceGeo.ts /root/gh_archive/sourceGeo.ts.bak-cov19-$TS && cp $REMOTE/src/data/rssSource.ts /root/gh_archive/rssSource.ts.bak-cov19-$TS && cp $REMOTE/scripts/collect-articles.mjs /root/gh_archive/collect-articles.mjs.bak-cov19-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/src/lib/sourceGeo.ts" "$SRV:$REMOTE/src/lib/sourceGeo.ts"
scp "$LOCAL/src/data/rssSource.ts" "$SRV:$REMOTE/src/data/rssSource.ts"
scp "$LOCAL/scripts/collect-articles.mjs" "$SRV:$REMOTE/scripts/collect-articles.mjs"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务（入口链自动跑 collect-articles 拉取新 feed）==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证（轮询等就绪：启动链先跑 collect 再 next start，大 feed 时约需 30-90s）==='
for i in $(seq 1 18); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done

echo '=== 6. 等待采集并抽查新分站文章数（最多 150s）==='
for i in $(seq 1 15); do
  sleep 10
  N=$(ssh "$SRV" "docker exec global-headlines node -e \"
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/app/data/global-headlines.sqlite');
const r=db.prepare(\\\"SELECT COUNT(*) c FROM articles WHERE source_url LIKE '%tass.com%' OR source_url LIKE '%cbc.ca%' OR source_url LIKE '%arabnews.com%' OR source_url LIKE '%globo.com%' OR source_url LIKE '%thehindu.com%' OR source_url LIKE '%sabcnews.com%' OR source_url LIKE '%abc.net.au%'\\\").get();
console.log(r.c);
\"" 2>/dev/null | tail -1)
  echo "  第 ${i} 次抽查：新分站文章 $N 篇"
  if [ "${N:-0}" -ge 20 ] 2>/dev/null; then echo "采集完成（$N 篇）"; break; fi
done

echo "=== cov19 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/sourceGeo.ts.bak-cov19-$TS $REMOTE/src/lib/sourceGeo.ts && cp /root/gh_archive/rssSource.ts.bak-cov19-$TS $REMOTE/src/data/rssSource.ts && cp /root/gh_archive/collect-articles.mjs.bak-cov19-$TS $REMOTE/scripts/collect-articles.mjs && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
