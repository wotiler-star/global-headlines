#!/usr/bin/env bash
# 部署 7 克隆语种(ms/fil/vi/th/my/bn/ur)真实译文到 starteday.com
# 流程: scp 译文JSON + 更新后的 indexnow.mjs 到服务器 -> docker cp 进 gh-data 卷 ->
#       merge-originals(内容upsert进 articles.json + SQLite) -> reset(裁剪非原创) ->
#       gen-rss -> indexnow(全19语种) -> restart 容器。
set -euo pipefail

SRV="root@43.155.171.45"
REMOTE_ROOT="/root/global-news-starteday"
REMOTE_ORIG="$REMOTE_ROOT/data/original"
REMOTE_SCRIPTS="$REMOTE_ROOT/scripts"
LOCAL_ORIG="$(cd "$(dirname "$0")" && pwd)/data/original"
LOCAL_SCRIPTS="$(cd "$(dirname "$0")" && pwd)/scripts"
LOCALES="ms fil vi th my bn ur"

echo "==> 1. scp 7 译文 JSON + indexnow.mjs 到服务器(build context)"
for loc in $LOCALES; do
  f="premium-${loc}-2026-11.json"
  if ! scp -q "$LOCAL_ORIG/$f" "$SRV:$REMOTE_ORIG/$f"; then
    echo "ERROR: scp $f 失败"; exit 1
  fi
  echo "  scp ok: $f"
done
if ! scp -q "$LOCAL_SCRIPTS/indexnow.mjs" "$SRV:$REMOTE_SCRIPTS/indexnow.mjs"; then
  echo "ERROR: scp indexnow.mjs 失败"; exit 1
fi
echo "  scp ok: indexnow.mjs"

echo "==> 2. docker cp 进卷 + 重建(服务器执行)"
ssh -o BatchMode=yes "$SRV" bash -s <<'REMOTE_EOF'
set -e
cd /root/global-news-starteday
for loc in ms fil vi th my bn ur; do
  f="premium-${loc}-2026-11.json"
  if ! docker cp "/root/global-news-starteday/data/original/$f" "global-headlines:/app/data/original/$f"; then
    echo "ERROR: docker cp $f 失败"; exit 1
  fi
  echo "  docker cp ok: $f"
done
# 同步更新后的 indexnow.mjs 进运行容器
docker cp "/root/global-news-starteday/scripts/indexnow.mjs" "global-headlines:/app/scripts/indexnow.mjs"
echo "==> merge-originals (内容 upsert 进 articles.json + SQLite)"
docker compose exec -T global-headlines node scripts/merge-originals.mjs
echo "==> reset-to-editorial (裁剪非原创)"
docker compose exec -T global-headlines node scripts/reset-to-editorial.mjs
echo "==> gen-rss"
docker compose exec -T global-headlines node scripts/gen-rss.mjs
echo "==> indexnow (全19语种, 720h窗口)"
docker compose exec -T global-headlines node scripts/indexnow.mjs 720 || echo "  [warn] indexnow 非200, 已忽略"
echo "==> restart global-headlines"
docker compose restart global-headlines
echo "==> 容器重启完成, 等待就绪"
sleep 8
docker compose exec -T global-headlines node -e "console.log('container alive')"
REMOTE_EOF
echo "==> 部署脚本结束"
