#!/bin/bash
# cov18 部署：搜索体验（联想下拉加分类项 + 结果 tab 方向键导航）
# 改动文件：
#   src/i18n/dictionaries.ts（新增 sugCategory，6 语言）
#   src/app/api/search/suggest/route.ts（分类建议置顶，最多 3 个）
#   src/components/SearchBox.tsx（分类项渲染 + 分类导航 + 键盘选择）
#   src/components/SearchResults.tsx（tablist 方向键导航 + roving tabindex + tabpanel + 空结果时 tab 常驻）
#   src/app/[locale]/search/page.tsx（有 q 即挂载 SearchResults，无结果分类不卸载 tab）
#   src/app/globals.css（.sp-tablist / .ss-kind / tab focus ring）
# 用法：在本地项目根目录运行（需能 ssh/scp 到服务器，且服务器 docker compose 可用）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov18_$TS.log

echo "本地项目: $LOCAL"
echo "远程项目: $SRV:$REMOTE"

echo '=== 1. 备份线上源码（回滚用）==='
ssh "$SRV" "mkdir -p /root/gh_archive && cp $REMOTE/src/i18n/dictionaries.ts /root/gh_archive/dictionaries.ts.bak-cov18-$TS && cp $REMOTE/src/app/api/search/suggest/route.ts /root/gh_archive/suggest-route.ts.bak-cov18-$TS && cp $REMOTE/src/components/SearchBox.tsx /root/gh_archive/SearchBox.tsx.bak-cov18-$TS && cp $REMOTE/src/components/SearchResults.tsx /root/gh_archive/SearchResults.tsx.bak-cov18-$TS && cp '$REMOTE/src/app/[locale]/search/page.tsx' '/root/gh_archive/search-page.tsx.bak-cov18-'$TS && cp $REMOTE/src/app/globals.css /root/gh_archive/globals.css.bak-cov18-$TS && echo 备份完成"

echo '=== 2. 推送改动文件到服务器 ==='
scp "$LOCAL/src/i18n/dictionaries.ts" "$SRV:$REMOTE/src/i18n/dictionaries.ts"
scp "$LOCAL/src/app/api/search/suggest/route.ts" "$SRV:$REMOTE/src/app/api/search/suggest/route.ts"
scp "$LOCAL/src/components/SearchBox.tsx" "$SRV:$REMOTE/src/components/SearchBox.tsx"
scp "$LOCAL/src/components/SearchResults.tsx" "$SRV:$REMOTE/src/components/SearchResults.tsx"
scp "$LOCAL/src/app/[locale]/search/page.tsx" "$SRV:$REMOTE/src/app/[locale]/search/page.tsx"
scp "$LOCAL/src/app/globals.css" "$SRV:$REMOTE/src/app/globals.css"
echo "推送完成"

echo '=== 3. 构建镜像 ==='
ssh "$SRV" "cd $REMOTE && docker compose build global-headlines" > "$LOG" 2>&1 && echo "构建成功" || { echo "构建失败:"; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启服务 ==='
ssh "$SRV" "cd $REMOTE && docker compose up -d global-headlines" 2>&1 | tail -3
sleep 8
ssh "$SRV" "docker ps --filter name=global-headlines --format '{{.Names}} {{.Status}}'"

echo '=== 5. 冒烟验证 ==='
ssh "$SRV" "curl -s -o /dev/null -w 'ZH 首页 HTTP %{http_code}\n' http://127.0.0.1:8082/zh; curl -s -o /dev/null -w 'EN 首页 HTTP %{http_code}\n' http://127.0.0.1:8082/en; curl -s -o /dev/null -w 'ZH 搜索页 HTTP %{http_code}\n' 'http://127.0.0.1:8082/zh/search?q=test'"

echo "=== cov18 部署完成 ==="
echo "回滚：ssh $SRV 'cp /root/gh_archive/dictionaries.ts.bak-cov18-$TS $REMOTE/src/i18n/dictionaries.ts && cp /root/gh_archive/suggest-route.ts.bak-cov18-$TS $REMOTE/src/app/api/search/suggest/route.ts && cp /root/gh_archive/SearchBox.tsx.bak-cov18-$TS $REMOTE/src/components/SearchBox.tsx && cp /root/gh_archive/SearchResults.tsx.bak-cov18-$TS $REMOTE/src/components/SearchResults.tsx && cp '/root/gh_archive/search-page.tsx.bak-cov18-'$TS '$REMOTE/src/app/[locale]/search/page.tsx' && cp /root/gh_archive/globals.css.bak-cov18-$TS $REMOTE/src/app/globals.css && cd $REMOTE && docker compose build global-headlines && docker compose up -d global-headlines'"
