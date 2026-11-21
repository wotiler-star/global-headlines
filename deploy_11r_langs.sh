#!/bin/bash
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL=F:/workbuddyxingqiuge/starteday.com/global-news-starteday
C=global-headlines
LANGS="en ja ko es fr pt tr"
for L in $LANGS; do
  F="premium-$L-2026-11r.json"
  scp -q "$LOCAL/data/original/$F" "$SRV:$REMOTE/data/original/$F" && echo "scp ok: $F"
  ssh -o BatchMode=yes $SRV "docker cp $REMOTE/data/original/$F $C:/app/data/original/$F" && echo "docker cp ok: $F"
done
echo "=== reset ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/reset-to-editorial.mjs | tail -2"
echo "=== RSS + IndexNow ==="
ssh -o BatchMode=yes $SRV "docker exec $C node scripts/gen-rss.mjs 2>&1 | tail -2 && docker exec $C node scripts/indexnow.mjs 72 2>&1 | tail -2"
echo "=== final counts ==="
ssh -o BatchMode=yes $SRV "docker exec $C node -e 'const a=require(\"/app/data/articles.json\");const arr=Array.isArray(a)?a:(a.articles||[]);const m={};arr.forEach(x=>m[x.locale]=(m[x.locale]||0)+1);console.log(\"TOTAL\",arr.length,\"zh\",m.zh,\"en\",m.en,\"ja\",m.ja,\"ko\",m.ko,\"es\",m.es,\"fr\",m.fr,\"pt\",m.pt,\"tr\",m.tr,\"zh-Hant\",m[\"zh-Hant\"])'"
