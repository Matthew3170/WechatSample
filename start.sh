#!/bin/sh

# 將 Nginx 設定檔中的 LISTEN_PORT 替換為 Render 提供的 PORT 環境變數
# 如果 PORT 未設定，則預設使用 10000
sed -i -e 's/LISTEN_PORT/'"$PORT"'/g' /etc/nginx/nginx.conf

# 啟動 supervisord 來管理 nginx 和 nodejs
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf