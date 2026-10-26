#!/bin/bash
# cov26 部署：货币汇率兑换浮动卡（地球旁 HUD 风格，纯前端静态汇率） + 性能优化
#  - 渲染：NewsCard 包 React.memo，长列表重渲染减负
#  - 数据层/TTFB：getArticles 加模块级 TTL 缓存（force-dynamic 下避免每次请求重跑 RSS 合并/注入）
#  - 新文件：src/lib/fx.ts（静态汇率表）、src/components/CurrencyConverter.tsx（转换器）
#  - 改：SignalDeck.tsx（嵌入转换器）、globals.css（fx-* 样式）、NewsCard.tsx（memo）、newsSource.ts（缓存）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov26_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/components/SignalDeck.tsx /root/gh_archive/SignalDeck.tsx.bak-cov26-$TS && cp $REMOTE/src/components/NewsCard.tsx /root/gh_archive/NewsCard.tsx.bak-cov26-$TS && cp $REMOTE/src/data/newsSource.ts /root/gh_archive/newsSource.ts.bak-cov26-$TS && cp $REMOTE/src/app/globals.css /root/gh_archive/globals.css.bak-cov26-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/src/lib/fx.ts" "$SRV:$REMOTE/src/lib/fx.ts"
scp "$LOCAL/src/components/CurrencyConverter.tsx" "$SRV:$REMOTE/src/components/CurrencyConverter.tsx"
scp "$LOCAL/src/components/SignalDeck.tsx" "$SRV:$REMOTE/src/components/SignalDeck.tsx"
scp "$LOCAL/src/components/NewsCard.tsx" "$SRV:$REMOTE/src/components/NewsCard.tsx"
scp "$LOCAL/src/data/newsSource.ts" "$SRV:$REMOTE/src/data/newsSource.ts"
scp "$LOCAL/src/app/globals.css" "$SRV:$REMOTE/src/app/globals.css"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证（轮询等就绪）==='
for i in $(seq 1 24); do
  ZH=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/zh" 2>/dev/null | tail -1)
  EN=$(ssh "$SRV" "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:8082/en" 2>/dev/null | tail -1)
  echo "  第 ${i} 次探测：ZH=$ZH EN=$EN"
  if [ "$ZH" = "200" ] && [ "$EN" = "200" ]; then break; fi
  sleep 10
done

echo "=== cov26 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/SignalDeck.tsx.bak-cov26-$TS $REMOTE/src/components/SignalDeck.tsx && cp /root/gh_archive/NewsCard.tsx.bak-cov26-$TS $REMOTE/src/components/NewsCard.tsx && cp /root/gh_archive/newsSource.ts.bak-cov26-$TS $REMOTE/src/data/newsSource.ts && cp /root/gh_archive/globals.css.bak-cov26-$TS $REMOTE/src/app/globals.css && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
