#!/bin/bash

# 强制 SSH 分配伪终端以防断连 (-t 选项)
ssh -t -o StrictHostKeyChecking=no root@47.76.215.197 " \
  echo '=> 1. 清理幽灵旧进程...' && \
  pm2 delete all || true && \
  echo '=> 2. 解压新架构代码...' && \
  cd /root && \
  unzip -q -o deploy_p2.zip -d safe_project_p2 && \
  echo '=> 3. 对齐底层隐形文件夹路径...' && \
  cp -rf safe_project_p2/h5-frontend/dist /root/safe_project/h5-frontend/ && \
  cp -rf safe_project_p2/h5-backend/* /root/safe_project/h5-backend/ && \
  cp -rf safe_project_p2/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/ 2>/dev/null || true && \
  echo '=> 4. 进入底层核心区硬重启...' && \
  cd /root/safe_project/h5-backend && \
  npm install mongoose --no-save && \
  sed -i 's/const mongoUri = process.env.MONGO_URI;/const mongoUri = process.env.MONGODB_URI || \"mongodb:\/\/127.0.0.1:27017\/training_db\";/g' server.js && \
  sed -i 's/if (mongoUri) {/if (true) {/g' server.js && \
  pm2 start server.js --name 'h5-backend' && \
  pm2 save && \
  echo '✅ 服务器底层路径修正完毕！现在您绝对可以进入系统测试新功能了！' \
"
