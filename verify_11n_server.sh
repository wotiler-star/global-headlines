#!/bin/bash
# verify_11n_server.sh — 部署后在服务器容器内用 127.0.0.1 交叉验证（比公网稳）
# 覆盖：articles 条数、8 语种首页各 3 篇、9 图 + 3 og 200、详情页正文/署名、
#       旧稿 404、CREDITS 组数与 imageCredits 条数。
SRV=root@43.155.171.45
C=global-headlines
BATCH=2026-11n
SLUGS="locust-cannibalism-scent fluorinated-electrolyte-battery smart-floss-metabolism"
LOCALES="zh en ja ko es fr pt tr"

ssh -o BatchMode=yes $SRV "docker exec $C sh -c '
echo \"=== 1. articles.json 条数 ===\" ;
node -e \"const a=JSON.parse(require(\\\"fs\\\").readFileSync(\\\"/app/data/articles.json\\\",\\\"utf8\\\"));console.log(\\\"TOTAL\\\",(Array.isArray(a)?a:(a.articles||[])).length)\" ;
echo \"=== 2. 8 语种首页各 3 篇新稿链接 ===\" ;
for L in $LOCALES; do
  H=\$(curl -s http://127.0.0.1:8082/\$L) ;
  N=0; for S in $SLUGS; do echo \"\$H\" | grep -q \"rss-orig-\$S-$BATCH\" && N=\$((N+1)); done ;
  echo \"  \$L: \$N/3\" ;
done ;
echo \"=== 3. 9 张 webp + 3 张 og 状态码 ===\" ;
for S in $SLUGS; do
  for R in cover fig1 fig2; do
    printf \"  %s-%s.webp \" \"\$S\" \"\$R\" ;
    curl -s -o /dev/null -w \"%{http_code}\\n\" http://127.0.0.1:8082/original/\$S-\$R.webp ;
  done ;
  printf \"  og/%s.jpg \" \"\$S\" ;
  curl -s -o /dev/null -w \"%{http_code}\\n\" http://127.0.0.1:8082/og/\$S.jpg ;
done ;
echo \"=== 4. 详情页正文段数 + 署名区块 + 文内 3 图 (zh) ===\" ;
for S in $SLUGS; do
  P=\$(curl -s http://127.0.0.1:8082/zh/article/rss-orig-\$S-$BATCH) ;
  CNT=\$(echo \"\$P\" | grep -o \"<p\" | wc -l) ;
  CRED=\$(echo \"\$P\" | grep -oi \"IMAGE CREDITS\\|commons.wikimedia\" | head -1) ;
  IMG=\$(echo \"\$P\" | grep -o \"/original/\$S-.*webp\" | sort -u | wc -l) ;
  echo \"  \$S: p=\$CNT cred=\${CRED:-NONE} img_refs=\$IMG\" ;
done ;
echo \"=== 5. 旧稿 404（历史去重删除的 ultracold-space） ===\" ;
curl -s -o /dev/null -w \"  ultracold-space: %{http_code}\\n\" http://127.0.0.1:8082/zh/article/rss-orig-ultracold-space-2026-11f ;
curl -s -o /dev/null -w \"  不存在的 id: %{http_code}\\n\" http://127.0.0.1:8082/zh/article/rss-orig-this-does-not-exist-2026-11n ;
echo \"=== 6. CREDITS 组数 / imageCredits 条数 ===\" ;
node -e \"const c=JSON.parse(require(\\\"fs\\\").readFileSync(\\\"/app/public/original/CREDITS.json\\\",\\\"utf8\\\"));console.log(\\\"CREDITS_GROUPS\\\",Object.keys(c).length)\" ;
grep -c \"/original/\" /app/src/lib/imageCredits.ts 2>/dev/null || echo \"  (imageCredits.ts 仅构建期在镜像内)\" ;
'"
