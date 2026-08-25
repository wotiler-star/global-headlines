#!/usr/bin/env bash
# 首次在新购的香港 VPS（Ubuntu/Debian）上执行一次：装 nginx + 防火墙 + 启用站点。
# 前置：已用 sync.sh 把 out/ 传到服务器 ~/headlines-out/
# 用法（本地 SSH 进 VPS 后）：
#   bash ~/headlines-out/../setup.sh   或把本文件单独传上去执行
set -e

APP=/var/www/headlines
SRC="$HOME/headlines-out"   # sync.sh 推送到的目录

echo "==> 更新系统并安装 nginx"
apt-get update -y
apt-get install -y nginx ufw

echo "==> 开放防火墙（22/80/443）"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 部署静态文件到 $APP"
rm -rf "$APP"
mkdir -p "$APP"
cp -r "$SRC"/. "$APP"/

echo "==> 写入 nginx 站点配置"
cp "$SRC/deploy/headlines.nginx.conf" /etc/nginx/sites-available/headlines
ln -sf /etc/nginx/sites-available/headlines /etc/nginx/sites-enabled/headlines
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

echo "==> 完成。浏览器访问 http://<你的VPS公网IP>/ 即可看到站点（自动跳 /zh）"
echo "==> 如需 HTTPS：把域名 A 记录指向该 IP，再执行："
echo "    apt-get install -y certbot python3-certbot-nginx"
echo "    certbot --nginx -d 你的域名"
