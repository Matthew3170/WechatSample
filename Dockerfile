# 1. 使用 Node.js 官方映像檔作為基礎
FROM node:18-slim

# 2. 安裝 Nginx 和 Supervisor
RUN apt-get update && apt-get install -y nginx supervisor

# 3. 設定工作目錄並複製 Node.js 應用
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 4. 複製設定檔
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 5. 複製並設定啟動腳本
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 6. 設定容器啟動時執行的指令
CMD ["/start.sh"]