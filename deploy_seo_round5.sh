#!/bin/bash
# deploy_seo_round5.sh — 文章页→主题实体档案内链（entity hub internal linking）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

P=src/app/[locale]/article/[id]/page.tsx
G=src/app/globals.css
FILES="$P $G"

echo "=== 1. SSH + 备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-seo5-$TS && echo backup ok"

echo "=== 2. /tmp 中转 scp ==="
for f in $FILES; do
  scp -q "$LOCAL/$f" "$SRV:/tmp/seo5_$(basename $f)_$TS.tsx"
  ssh -o BatchMode=yes $SRV "mv /tmp/seo5_$(basename $f)_$TS.tsx '$REMOTE/$f' && echo 'put ok: $f'"
done

echo "=== 3. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -2"

sleep 14
echo "=== 4. 验收：主题档案内链 + 零死链 ==="
ssh -o BatchMode=yes $SRV "
U=/zh/article/rss-orig-china-webnovel-global-2026-11j
curl -s 127.0.0.1:8082\$U -o /tmp/seo5.html
echo -n '主题档案链接存在: '; grep -o '/zh/topic/china-webnovel-global' /tmp/seo5.html | head -1
echo -n 'article JSON-LD 完好: '; grep -o 'NewsArticle' /tmp/seo5.html | head -1
# 验证主题链接 200（非死链）
echo -n '主题页 200: '; curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8082/zh/topic/china-webnovel-global
# 对比：非 rss-orig 文章不应出现主题档案链接
curl -s 127.0.0.1:8082/zh/article/\$(docker exec $C node -e 'const a=require(\"/app/data/articles.json\");const x=a.find(y=>!y.id.startsWith(\"rss-orig-\"));console.log(x?x.id:\"\")') -o /tmp/seo5b.html 2>/dev/null
echo -n '非原创稿主题链接数(应0): '; grep -o '/topic/' /tmp/seo5b.html 2>/dev/null | wc -l
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
rm -f /tmp/seo5.html /tmp/seo5b.html
"

echo "=== 5. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $FILES"
cd "$LOCAL" && md5sum $FILES
echo "=== deploy_seo_round5 done ==="
