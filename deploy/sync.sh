#!/usr/bin/env bash
# 本地执行：把最新构建的 out/ 同步到香港 VPS 并热更新（不中断 nginx）。
# 用法：
#   SERVER=user@1.2.3.4 bash deploy/sync.sh
# 或先 export SERVER=... 再 bash deploy/sync.sh
set -e

SERVER="${SERVER:?请设置 SERVER，例如：SERVER=root@1.2.3.4 bash deploy/sync.sh}"

LOCAL_OUT="$(cd "$(dirname "$0")/.." && pwd)/out"

echo "==> 同步 out/ -> $SERVER:~/headlines-out/"
rsync -az --delete \
  --exclude='.git' \
  "$LOCAL_OUT"/ "$SERVER":~/headlines-out/

echo "==> 在服务器上刷新站点文件"
ssh "$SERVER" "rm -rf /var/www/headlines && cp -r ~/headlines-out /var/www/headlines && echo refreshed"

echo "==> 完成。访问 http://<VPS公网IP>/"
