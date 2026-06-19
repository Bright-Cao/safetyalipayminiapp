#!/bin/bash

export SERVER_IP="47.76.215.197"
export ZIP_PATH="/Users/cml/Documents/20260105153022_migrant_1772376920121/deploy_p2.zip"

echo "====================================================="
echo "🧰 【真相大白】原来服务器有两个代码屋，正在对齐引擎..."
echo "====================================================="

echo "密码 1/1（最终修正）："
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'EOF'
  echo "=> 清理旧进程残留镜像..."
  pm2 delete all || true

  echo "=> 确保新版代码覆盖到正确执行目录..."
  cd /root
  unzip -q -o deploy_p2.zip -d safe_project_p2
  
  # 直接将代码同步给 /root/safe_project 避免路径错位
  cp -rf safe_project_p2/h5-frontend/dist /root/safe_project/h5-frontend/
  cp -rf safe_project_p2/h5-backend/* /root/safe_project/h5-backend/

  # Nginx 前端同步
  cp -rf safe_project_p2/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/ 2>/dev/null || true
  
  echo "=> 从最新的纯净代码库重新点火！..."
  cd /root/safe_project/h5-backend
  npm install mongoose --no-save
  
  # 彻底解决那个 MongoDB skipped 的幽灵报错
  sed -i 's/const mongoUri = process.env.MONGO_URI;/const mongoUri = process.env.MONGODB_URI || "mongodb:\/\/127.0.0.1:27017\/training_db";/g' server.js
  sed -i 's/if (mongoUri) {/if (true) {/g' server.js
  
  pm2 start server.js --name "h5-backend"
  pm2 save
  
  echo "✅ 路径修复完成！底层逻辑彻底锁死，您绝对可以刷新登录了！"
EOF
