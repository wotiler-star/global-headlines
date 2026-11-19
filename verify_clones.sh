#!/usr/bin/env bash
# 验证 7 克隆语种译文已上线: 首页/rss/article 全 200, 且文章页含真实译文(非英文克隆)。
# 在 deploy_clones.sh 之后运行。
set -uo pipefail
SITE="https://starteday.com"
LOCALES="ms fil vi th my bn ur"
LOCAL="$(cd "$(dirname "$0")" && pwd)/data/original"

echo "=== 1. 首页 200 + <html lang> ==="
for loc in $LOCALES; do
  code=$(curl -s -o /tmp/h_$loc.html -w "%{http_code}" --max-time 30 "$SITE/$loc")
  lang=$(grep -o 'lang="[^"]*"' /tmp/h_$loc.html | head -1)
  echo "  $loc -> HTTP $code  $lang"
done

echo "=== 2. rss.xml 200 + <item> 数 ==="
for loc in $LOCALES; do
  code=$(curl -s -o /tmp/r_$loc.xml -w "%{http_code}" --max-time 30 "$SITE/$loc/rss.xml")
  items=$(grep -c "<item>" /tmp/r_$loc.xml 2>/dev/null || echo 0)
  echo "  $loc/rss.xml -> HTTP $code  items=$items"
done

echo "=== 3. 文章页抽查: HTTP 200 + 含本地译文标题 ==="
for loc in $LOCALES; do
  id=$(node -e "console.log(require('$LOCAL/premium-$loc-2026-11.json')[0].id)" 2>/dev/null)
  code=$(curl -s -o /tmp/a_$loc.html -w "%{http_code}" --max-time 30 "$SITE/$loc/article/$id")
  title=$(node -e "const t=require('$LOCAL/premium-$loc-2026-11.json')[0].title; console.log(t.slice(0,18))" 2>/dev/null)
  hit=$(grep -c -- "$title" /tmp/a_$loc.html 2>/dev/null || echo 0)
  echo "  $loc article $id -> HTTP $code  titleHit=$hit"
done

echo "=== 4. sitemap 含 7 语种 ==="
curl -s --max-time 30 "$SITE/sitemap.xml" -o /tmp/sm.xml
for loc in $LOCALES; do
  c=$(grep -c "/$loc/" /tmp/sm.xml 2>/dev/null || echo 0)
  echo "  sitemap /$loc/ 出现 $c 次"
done
echo "=== verify done ==="
