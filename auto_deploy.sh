#!/bin/bash

# Configuration
SERVER_IP="47.76.215.197"
ZIP_PATH="/Users/cml/Documents/20260105153022_migrant_1772376920121/deploy.zip"

echo "=========================================="
echo "开始向阿里云服务器 ($SERVER_IP) 部署系统..."
echo "=========================================="

# 1. Uploading the file
echo ">>> [步骤 1/2] 正在向云端推送信使压缩包。下面可能会提示您输入云服务器的 root 密码："
scp "$ZIP_PATH" root@$SERVER_IP:/root/

if [ $? -ne 0 ]; then
    echo "⚠️ 上传失败！可能是密码错误或服务器网络不通，请重试。"
    exit 1
fi
echo "✅ 推送代码包成功！"

# 2. Executing setup on the remote server
echo ""
echo ">>> [步骤 2/2] 正在让云端自我解压并安装运行环境（MongoDB, Node.js, PM2）..."
echo "下面可能还会要求您最后一次输入云服务器的密码："

ssh root@$SERVER_IP << 'EOF'
  echo ">>> [远程执行] 更新 apt 源并安装解压套装..."
  apt-get update && apt-get install -y unzip curl

  echo ">>> [远程执行] 获取官方 Node.js (v20)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs mongodb

  echo ">>> [远程执行] 配置长效运行组件并启动数据库..."
  npm install pm2 -g
  systemctl start mongodb && systemctl enable mongodb

  echo ">>> [远程执行] 解压打包的代码文件..."
  cd /root
  unzip -o deploy.zip -d safe_project
  cd /root/safe_project

  echo ">>> [远程执行] 正在安装后端依赖..."
  cd h5-backend
  npm install

  echo ">>> [远程执行] ⚡ PM2 守护启动后端应用..."
  pm2 stop h5-backend || true
  pm2 start ecosystem.config.js
  pm2 save

  echo "=========================================================="
  echo "🎉 恭喜！后端服务和数据库已在香港服务器上完美运行！"
  echo "=========================================================="
EOF
