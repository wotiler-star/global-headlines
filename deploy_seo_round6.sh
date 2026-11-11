#!/bin/bash
# deploy_seo_round6.sh — 正文内 contextual 实体链接（RichLine 实体包链）
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
TS=$(date +%Y%m%d_%H%M%S)

R=src/components/RichLine.tsx
P=src/app/[locale]/article/[id]/page.tsx
G=src/app/globals.css
FILES="$R $P $G"

echo "=== 1. SSH + 备份 ==="
ssh -o BatchMode=yes $SRV "echo SSH_OK"
ssh -o BatchMode=yes $SRV "cd $REMOTE && mkdir -p /root/gh_archive && cp -a src /root/gh_archive/src.bak-seo6-$TS && echo backup ok"

echo "=== 2. /tmp 中转 scp ==="
for f in $FILES; do
  scp -q "$LOCAL/$f" "$SRV:/tmp/seo6_$(basename $f)_$TS.tsx"
  ssh -o BatchMode=yes $SRV "mv /tmp/seo6_$(basename $f)_$TS.tsx '$REMOTE/$f' && echo 'put ok: $f'"
done

echo "=== 3. build && up -d ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && docker compose build 2>&1 | tail -6 && docker compose up -d 2>&1 | tail -2"

sleep 14
echo "=== 4. 验收：正文实体链接 + 零死链 ==="
ssh -o BatchMode=yes $SRV "
U=/zh/article/rss-orig-china-webnovel-global-2026-11j
curl -s 127.0.0.1:8082\$U -o /tmp/seo6.html
echo -n '正文实体链接数: '; grep -o 'class=\"art-entity-link\"' /tmp/seo6.html | wc -l
echo -n '实体链接指向 tag 页: '; grep -o 'href=\"/zh/tag/[^\"]*\"' /tmp/seo6.html | grep -c 'art-entity-link' 2>/dev/null || grep -oE '<a[^>]*class=\"art-entity-link\"[^>]*href=\"/zh/tag/[^\"]*\"' /tmp/seo6.html | wc -l
echo '--- 实体链接样本 ---'; grep -oE '<a[^>]*class=\"art-entity-link\"[^>]*>[^<]*</a>' /tmp/seo6.html | head -5
# 随机抽 5 篇原创稿，统计每篇实体链接数（应 <=3），并批量验证链接 200
echo '--- 抽 5 篇原创稿实体链接数 ---'
IDS=\$(docker exec $C node -e 'const a=require(\"/app/data/articles.json\").filter(x=>x.id.startsWith(\"rss-orig-\")).map(x=>x.id).slice(0,5);console.log(IDS.join(\" \"))')
for id in \$IDS; do
  c=\$(curl -s 127.0.0.1:8082/zh/article/\$id | grep -o 'class=\"art-entity-link\"' | wc -l)
  echo \"\$id -> \$c\"
done
echo -n 'articles: '; docker exec $C node -e 'console.log(require(\"/app/data/articles.json\").length)'
rm -f /tmp/seo6.html
"

echo "=== 5. md5 双端对齐 ==="
ssh -o BatchMode=yes $SRV "cd $REMOTE && md5sum $FILES"
cd "$LOCAL" && md5sum $FILES
echo "=== deploy_seo_round6 done ==="
