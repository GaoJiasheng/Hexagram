#!/usr/bin/env bash
# 一键发布「观象」到云主机(119.23.77.106 · nginx · 80 端口)
#
# 用法:  ./deploy.sh
#   构建 dist → rsync 增量同步到服务器 → reload nginx。免密(走 SSH key)。
#
# 前置(已在本机配好,换机器才需重做):
#   1) 部署密钥 ~/.ssh/hexagram_deploy(已 ssh-copy-id 到服务器)
#   2) ~/.ssh/config 里的别名:
#        Host hexagram-prod
#          HostName 119.23.77.106
#          User root
#          IdentityFile ~/.ssh/hexagram_deploy
#   服务器侧 nginx 站点:/etc/nginx/sites-available/hexagram,根目录 /var/www/hexagram
#
# 缓存策略:/assets/ 带 hash 永久缓存;index.html / sw.js 不缓存 → 发布即生效。
set -euo pipefail
cd "$(dirname "$0")"

REMOTE="hexagram-prod"
WEBROOT="/var/www/hexagram/"

echo "▶ 1/3 构建生产包..."
npm run build

echo "▶ 2/3 增量同步到服务器(--delete 清旧 hash 资源)..."
rsync -az --delete dist/ "${REMOTE}:${WEBROOT}"

echo "▶ 3/3 reload nginx..."
ssh "$REMOTE" 'systemctl reload nginx'

echo "✅ 已发布 → http://119.23.77.106/"
