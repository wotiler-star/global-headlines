#!/bin/bash
# cov16 部署：彻底消除首页偶发 React #418
# 根因：首页 force-static 以「空参数」预渲染 useSearchParams 组件，客户端按真实参数首渲 → 树不一致。
# 修复：首页改 force-dynamic（SSR 按真实请求参数渲染）；SW 导航 HTML 不再进缓存（离线回退 /zh）。
set -e
cd /root/global-news-starteday
TS=$(date +%Y%m%d_%H%M%S)
STAGE=/root/gh_stage_cov16
mkdir -p /root/gh_archive

echo '=== 1. 备份线上当前源码（用于回滚）==='
cp "src/app/[locale]/page.tsx" /root/gh_archive/home_page.tsx.bak-cov16-$TS
cp public/sw.js /root/gh_archive/sw.js.bak-cov16-$TS
cp src/components/PwaRegister.tsx /root/gh_archive/PwaRegister.tsx.bak-cov16-$TS
cp "src/app/[locale]/layout.tsx" /root/gh_archive/home_layout.tsx.bak-cov16-$TS

echo '=== 2. 覆盖 cov16 新源码（来自暂存）==='
cp "$STAGE/home_page.tsx" "src/app/[locale]/page.tsx"
cp "$STAGE/sw.js" public/sw.js
cp "$STAGE/PwaRegister.tsx" src/components/PwaRegister.tsx
cp "$STAGE/home_layout.tsx" "src/app/[locale]/layout.tsx"

echo '=== 3. 构建 ==='
LOG=/root/gh_build_cov16_$TS.log
docker compose build global-headlines > "$LOG" 2>&1 && echo 构建成功 || { echo 构建失败:; tail -40 "$LOG"; exit 1; }

echo '=== 4. 重启与验证 ==='
docker compose up -d global-headlines 2>&1 | tail -2
sleep 8
docker ps --filter name=global-headlines --format '{{.Status}}'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:8082/zh
curl -s -o /dev/null -w 'EN 首页 HTTP %{http_code}\n' http://127.0.0.1:8082/en
