#!/bin/bash
# deploy_cov47.sh — Google 收录专项 SEO 优化
# 1) 会员/后台页 noindex（robots.txt 同步收敛，避免 disallow 挡住 noindex）
# 2) 分类页差异化 title/description，sitemap 移除 canonical 指向首页的重复分类 URL
# 3) 文章结构化数据图片绝对化 + publisher logo
# 4) sitemap lastModified 用文章真实发布时间
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov47_$TS.log
D="start""eday.com"

FILES=(
  "src/app/[locale]/page.tsx"
  "src/app/[locale]/article/[id]/page.tsx"
  "src/app/[locale]/login/page.tsx"
  "src/app/[locale]/register/page.tsx"
  "src/app/[locale]/write/page.tsx"
  "src/app/[locale]/me/page.tsx"
  "src/app/[locale]/admin/page.tsx"
  src/app/robots.ts
  src/app/sitemap.ts
)

echo "=== 1. 备份 + 推送 ${#FILES[@]} 个文件 ==="
ssh "$SRV" "mkdir -p /root/gh_archive"
for f in "${FILES[@]}"; do
  ssh "$SRV" "cp '$REMOTE/$f' '/root/gh_archive/$(basename "${f//\//_}").bak-cov47-$TS'" 2>/dev/null || true
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then echo "  推送失败: $f"; exit 1; fi
  echo "  推送 $f"
done

echo "=== 2. 重建镜像 + 重启 ==="
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

echo "=== 3. robots.txt / sitemap ==="
ssh "$SRV" "echo '--- robots.txt ---'; curl -s -m 20 http://127.0.0.1:8082/robots.txt; echo '--- sitemap ---'; curl -s -m 30 http://127.0.0.1:8082/sitemap.xml -o /tmp/sm47.xml -w 'http=%{http_code} bytes=%{size_download}\n'; echo -n '  URL 数: '; grep -c '<loc>' /tmp/sm47.xml; echo -n '  分类页(应为0): '; grep -c '?cat=' /tmp/sm47.xml || true; echo -n '  lastmod 样例: '; grep -o '<lastmod>[^<]*</lastmod>' /tmp/sm47.xml | head -3" 2>/dev/null

echo "=== 4. 页面元数据实证 ==="
ssh "$SRV" "echo '  [首页]'; curl -s -m 40 http://127.0.0.1:8082/zh | grep -o '<title>[^<]*</title>' | head -1; echo '  [分类页 tech]'; curl -s -m 40 'http://127.0.0.1:8082/zh?cat=tech' | grep -o '<title>[^<]*</title>' | head -1; echo '  [分类页 world]'; curl -s -m 40 'http://127.0.0.1:8082/zh?cat=world' | grep -o '<title>[^<]*</title>' | head -1; for U in login register write me admin; do printf '  [%s] ' \$U; curl -s -m 40 http://127.0.0.1:8082/zh/\$U | grep -io '<meta name=\"robots\"[^>]*>' | head -1; done; echo '  [文章页结构化数据图片]'; curl -s -m 40 http://127.0.0.1:8082/zh/article/rss-orig-spatial-glasses-2026-11 | grep -o 'https://$D/original/[^\"]*' | head -3; echo '  [hreflang/x-default]'; curl -s -m 40 http://127.0.0.1:8082/zh -o /tmp/h47.html; echo -n '    hreflang 数: '; grep -ioc 'hreflang=' /tmp/h47.html; echo -n '    x-default: '; grep -io 'hreflang=\"x-default\"' /tmp/h47.html | head -1; echo -n '    GSC meta: '; grep -c 'google-site-verification' /tmp/h47.html" 2>/dev/null

echo "=== 5. 公网复核（正确域名 $D）==="
for P in /robots.txt /sitemap.xml /zh /zh/article/rss-orig-spatial-glasses-2026-11; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $P -> %{http_code}\n' -m 30 https://$D$P" 2>/dev/null | tail -1
done
echo "=== cov47 完成（日志 $LOG）==="
