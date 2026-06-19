#!/bin/bash

# Configuration
SERVER_IP="47.76.215.197"
ZIP_PATH="/Users/cml/Documents/20260105153022_migrant_1772376920121/frontend_update.zip"

echo "=========================================="
echo "开始向阿里云服务器 ($SERVER_IP) 更新前端网页..."
echo "=========================================="

echo ">>> 正在推送信压缩包。请在下方输入云服务器的 root 密码："
scp "$ZIP_PATH" root@$SERVER_IP:/root/frontend_update.zip

if [ $? -ne 0 ]; then
    echo "⚠️ 上传失败！可能是密码错误或服务器网络不通，请重试。"
    exit 1
fi

echo ">>> [步骤 2/2] 上传成功！正在云端替换旧网页文件..."
echo "下面可能还会要求您最后一次输入云服务器的密码："

ssh root@$SERVER_IP << 'EOF'
  cd /root
  unzip -o frontend_update.zip -d /var/www/safe_project/h5-frontend/
  chown -R www-data:www-data /var/www/safe_project
  chmod -R 755 /var/www/safe_project

  echo "=========================================================="
  echo "🎉 恭喜！最新网页已成功更新至云端，刷新即可看到！"
  echo "=========================================================="
EOF
