#!/bin/bash
set -e

SERVER="47.76.215.197"
ZIP="/Users/cml/Documents/20260105153022_migrant_1772376920121/deploy_p3.zip"

echo "=================================================="
echo "🚀 [三期] 推送权限系统 + 仪表盘优化到云端"
echo "=================================================="

echo "📦 [1/2] 上传代码包..."
scp -o StrictHostKeyChecking=no "$ZIP" root@$SERVER:/root/

echo "⚙️  [2/2] 远程部署中..."
ssh -t -o StrictHostKeyChecking=no root@$SERVER " \
  echo '解压代码...' && \
  cd /root && unzip -q -o deploy_p3.zip -d safe_p3 && \
  echo '同步前端静态文件...' && \
  cp -rf safe_p3/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/ && \
  echo '同步后端代码到 www 目录...' && \
  cp -rf safe_p3/h5-backend/controllers /var/www/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/routes /var/www/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/models /var/www/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/middleware /var/www/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/scripts /var/www/safe_project/h5-backend/ && \
  cp    safe_p3/h5-backend/server.js  /var/www/safe_project/h5-backend/ && \
  echo '同步到 PM2 实际运行目录 (/root/safe_project)...' && \
  cp -rf safe_p3/h5-backend/controllers /root/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/routes /root/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/models /root/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/middleware /root/safe_project/h5-backend/ && \
  cp -rf safe_p3/h5-backend/scripts /root/safe_project/h5-backend/ && \
  cp    safe_p3/h5-backend/server.js  /root/safe_project/h5-backend/ && \
  echo '重启服务...' && \
  cd /var/www/safe_project/h5-backend && pm2 restart h5-backend && \
  echo '' && \
  echo '========================================' && \
  echo '🎉 三期部署成功！' && \
  echo '✅ 新功能：' && \
  echo '   - 登录安全加固（角色从数据库读取）' && \
  echo '   - 仪表盘按角色动态显示菜单' && \
  echo '   - 管理后台人员权限分配界面' && \
  echo '   - 超管初始化脚本' && \
  echo '========================================' \
"
