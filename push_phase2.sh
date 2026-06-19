#!/bin/bash

export SERVER_IP="47.76.215.197"
export ZIP_PATH="/Users/cml/Documents/20260105153022_migrant_1772376920121/deploy_p2.zip"

echo "====================================================="
echo "🚀 正在部署二期大本营代码到阿里云 ($SERVER_IP)..."
echo "====================================================="
echo ""
echo ">>> [步骤 1/2] 正在上传最新服务器代码和前端静态文件"
echo "👉 这边需要您输入一次服务器 root 密码（不会显示密码字符）："
scp -o StrictHostKeyChecking=no "$ZIP_PATH" root@$SERVER_IP:/root/

if [ $? -ne 0 ]; then
    echo "⚠️ 上传失败！可能是密码输错或网络问题，请重新跑一下试试。"
    exit 1
fi
echo "✅ 上传第二期架构引擎成功！"
echo ""

echo ">>> [步骤 2/2] 正在远程执行热更新重启..."
echo "👉 这边可能需要您最后一次验证权限（再输一次服务器密码）："
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'EOF'
  echo "=> 正在云端解压最新更新包..."
  cd /root
  unzip -q -o deploy_p2.zip -d safe_project_p2
  
  echo "=> 正在替换新版【管理后台与前端打分】代码..."
  cp -rf safe_project_p2/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/
  cp -rf safe_project_p2/h5-backend/* /var/www/safe_project/h5-backend/
  
  echo "=> 修复全新环境权限并重启 PM2 服务..."
  chown -R www-data:www-data /var/www/safe_project
  cd /var/www/safe_project/h5-backend
  pm2 restart all

  echo ""
  echo "========================================================================"
  echo "🎉 【二期特批双轨制全新业务线 —— 升级彻底成功！】"
  echo "全新功能已上线: "
  echo "1) 申请表已增设: 监护人/班组长/主要负责人/专职安全员选项！"
  echo "2) 车间主任/安全科登录后可见专属【待审批界面】！"
  echo "3) 特权用户的免考特批通道已经完全开启。"
  echo "========================================================================"
EOF
