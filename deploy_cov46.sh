#!/bin/bash
# deploy_cov46.sh — Google Search Console 站点所有权验证
# 方式 A（主）：layout.tsx metadata.verification.google → 全语种 SSR <meta>
# 方式 B（兜底）：public/google<token>.html 根路径静态文件
set -e
SRV=root@43.155.171.45
REMOTE=/root/global-news-starteday
LOCAL="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
LOG=/tmp/gh_build_cov46_$TS.log
TOKEN=88gJuwAfrMYN7Dj6ClSV7FmUB7M67d543Nb6ejwyB9c
HTML=google${TOKEN}.html

echo "=== 1. 备份 + 推送 ==="
ssh "$SRV" "cp $REMOTE/src/app/[locale]/layout.tsx /root/gh_archive/layout.tsx.bak-cov46-$TS" 2>/dev/null || ssh "$SRV" "cp '$REMOTE/src/app/[locale]/layout.tsx' /root/gh_archive/layout.tsx.bak-cov46-$TS"
for f in "src/app/[locale]/layout.tsx" "public/$HTML"; do
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

echo "=== 3. 八语种 <head> meta 检查（源站）==="
for L in zh en ja ko es fr pt tr; do
  ssh "$SRV" "printf '  [%s] ' $L; curl -s -m 60 http://127.0.0.1:8082/$L | grep -o '<meta name=\"google-site-verification\"[^>]*>' | head -1" 2>/dev/null | tail -1
done
echo "=== 4. Googlebot UA + 根路径重定向 ==="
ssh "$SRV" "printf '  [Googlebot /] '; curl -sL -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' -m 60 http://127.0.0.1:8082/ | grep -o 'content=\"$TOKEN\"' | head -1; printf '  [zh 精确匹配] '; curl -s -m 60 http://127.0.0.1:8082/zh | grep -c 'content=\"$TOKEN\"'" 2>/dev/null | tail -2
echo "=== 5. 静态验证文件 ==="
ssh "$SRV" "curl -s -o /tmp/gv.html -w '  /$HTML -> %{http_code} (%{size_download} B)\n' -m 20 http://127.0.0.1:8082/$HTML; echo -n '  内容: '; cat /tmp/gv.html" 2>/dev/null | tail -2
echo "=== 6. 公网 HTTPS 复核 ==="
ssh "$SRV" "printf '  [裸域 /] '; curl -sL -m 40 https://starteday.com/ | grep -o 'content=\"$TOKEN\"' | head -1; printf '  [www /] '; curl -sL -m 40 https://www.starteday.com/ | grep -o 'content=\"$TOKEN\"' | head -1; printf '  [验证文件] '; curl -s -o /dev/null -w '%{http_code}\n' -m 30 https://starteday.com/$HTML" 2>/dev/null | tail -3
echo "=== cov46 完成（日志 $LOG）==="
