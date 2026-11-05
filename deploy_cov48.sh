#!/bin/bash
# deploy_cov48.sh — 8 语种原创稿 + Wikimedia Commons 真实照片替换 AI 图
# 用户要求：补齐双语/多语、文章全部原创、图片必须来自互联网免费图库且不是 AI 生成
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov48_$TS.log
D="start""eday.com"

PREMIUMS=(
  premium-2026-11.json
  premium-en-2026-11.json
  premium-ja-2026-11.json
  premium-ko-2026-11.json
  premium-es-2026-11.json
  premium-fr-2026-11.json
  premium-pt-2026-11.json
  premium-tr-2026-11.json
)
IMAGES=(
  spatial-glasses-cover spatial-glasses-fig1 spatial-glasses-fig2
  edge-ai-chip-cover edge-ai-chip-fig1 edge-ai-chip-fig2
  car-ai-cover car-ai-fig1 car-ai-fig2
)
CODE=(
  public/original/CREDITS.json
  src/lib/imageCredits.ts
  "src/app/[locale]/article/[id]/page.tsx"
  src/app/globals.css
)

echo "=== 1. 备份 ==="
ssh "$SRV" "mkdir -p /root/gh_archive"
ssh "$SRV" "docker cp global-headlines:/app/data/articles.json /root/gh_archive/articles.json.bak-cov48-$TS" && echo "  备份 articles.json"
ssh "$SRV" "docker cp global-headlines:/app/data/global-headlines.sqlite /root/gh_archive/global-headlines.sqlite.bak-cov48-$TS" && echo "  备份 SQLite"
for f in "${CODE[@]}"; do ssh "$SRV" "cp '$REMOTE/$f' '/root/gh_archive/$(basename "${f//\//_}").bak-cov48-$TS'" 2>/dev/null || true; done

echo "=== 2. 推送 8 个语种稿 + 9 张真实图 + 代码 ==="
for n in "${PREMIUMS[@]}"; do
  if ! scp -q "$LOCAL/data/original/$n" "$SRV:$REMOTE/data/original/$n"; then echo "  推送失败 $n"; exit 1; fi
  echo "  推送 $n"
done
for n in "${IMAGES[@]}"; do
  if ! scp -q "$LOCAL/public/original/$n.webp" "$SRV:$REMOTE/public/original/$n.webp"; then echo "  推送失败 $n.webp"; exit 1; fi
done
echo "  推送 9 张真实照片"
for f in "${CODE[@]}"; do
  if ! scp -q "$LOCAL/$f" "$SRV:$REMOTE/$f"; then echo "  推送失败 $f"; exit 1; fi
  echo "  推送 $f"
done

echo "=== 3. 清理旧的 AI 生成图片（不再被任何文章引用）==="
ssh "$SRV" "rm -f $REMOTE/public/original/chogm-*.webp $REMOTE/public/original/ciie-*.webp $REMOTE/public/original/opensource-*.webp $REMOTE/public/original/tech-agents-fig1.svg && echo '  已删宿主机旧 AI 图'"

echo "=== 4. premium 文件送入 Docker volume（关键：宿主机目录不生效）==="
for n in "${PREMIUMS[@]}"; do
  ssh "$SRV" "docker cp $REMOTE/data/original/$n global-headlines:/app/data/original/$n"
done
echo "  已送入 8 个语种文件"

echo "=== 5. 重置 + 重建镜像 + 重启 ==="
ssh "$SRV" "docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true
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

echo "=== 6. 幂等重置 + 重建 RSS ==="
ssh "$SRV" "docker exec global-headlines node scripts/reset-to-editorial.mjs" 2>&1 | grep -E "^\[reset\]" | tail -5 || true
ssh "$SRV" "docker exec global-headlines node scripts/gen-rss.mjs" 2>&1 | grep -E "^\[rss\] wrote" | tail -10 || true

echo "=== 7. 终态实证 ==="
ssh "$SRV" "docker exec global-headlines node --input-type=module -e \"
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('data/articles.json','utf8'));
const by={}; for(const a of d) by[a.locale]=(by[a.locale]||0)+1;
console.log('  文章数:',d.length,'按语种:',JSON.stringify(by));
console.log('  每篇图片数:',JSON.stringify([...new Set(d.map(a=>(a.images||[]).length))]));
\"" 2>/dev/null | tail -3
ssh "$SRV" "python3 - <<'PY'
import urllib.request, re
for l in ['zh','en','ja','ko','es','fr','pt','tr']:
    try:
        s = urllib.request.urlopen('http://127.0.0.1:8082/'+l, timeout=45).read().decode('utf8','replace')
        links = set(re.findall(r'href=\"/'+l+r'/article/[^\"]+\"', s))
        print('  [%s] 首页文章链接 %d' % (l, len(links)))
    except Exception as e:
        print('  [%s] ERROR %s' % (l, e))
PY" 2>/dev/null
ssh "$SRV" "echo '  9 张真实图:'; for n in spatial-glasses-cover spatial-glasses-fig1 spatial-glasses-fig2 edge-ai-chip-cover edge-ai-chip-fig1 edge-ai-chip-fig2 car-ai-cover car-ai-fig1 car-ai-fig2; do printf '    %s ' \$n; curl -s -o /dev/null -w '%{http_code}\n' -m 20 http://127.0.0.1:8082/original/\$n.webp; done; echo -n '  CREDITS 里 AI 生成标注数: '; grep -c 'AI generated' $REMOTE/public/original/CREDITS.json || true; echo -n '  文章页署名区块: '; curl -s -m 40 http://127.0.0.1:8082/zh/article/rss-orig-spatial-glasses-2026-11 | grep -c 'art-image-credits'; echo -n '  sitemap URL 数: '; curl -s -m 30 http://127.0.0.1:8082/sitemap.xml | grep -c '<loc>'" 2>/dev/null
echo "=== 8. 公网复核（$D）==="
for P in /zh /en /ja /sitemap.xml /original/spatial-glasses-cover.webp; do
  ssh "$SRV" "curl -s -o /dev/null -w '  $P -> %{http_code}\n' -m 30 https://$D$P" 2>/dev/null | tail -1
done
echo "=== cov48 完成（日志 $LOG）==="
