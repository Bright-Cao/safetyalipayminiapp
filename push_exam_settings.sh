#!/bin/bash
# 使用 sshpass 自动化密码认证的部署脚本

set -e

SERVER="47.76.215.197"
PASSWORD="Cml5711@1998."
PROJECT_DIR="/Users/cml/Documents/20260105153022_migrant_1772376920121"
TMP_ZIP="/tmp/exam_settings_update.zip"

SSH="sshpass -p ${PASSWORD} ssh -o StrictHostKeyChecking=no root@${SERVER}"
SCP="sshpass -p ${PASSWORD} scp -o StrictHostKeyChecking=no"

echo ""
echo "============================================================"
echo "🔧 考试设置 + 培训视频修复 热更新 → 服务器 $SERVER"
echo "============================================================"

# 步骤 1: 构建前端
echo ""
echo "📦 [1/4] 正在构建前端..."
cd "$PROJECT_DIR/h5-frontend"
npm run build
echo "   ✅ 前端构建完成"

# 步骤 2: 打包
echo ""
echo "🗜  [2/4] 正在打包更新文件..."
cd "$PROJECT_DIR"
rm -f "$TMP_ZIP"
zip -r "$TMP_ZIP" \
  h5-backend/controllers/application.js \
  h5-backend/controllers/exam.js \
  h5-backend/controllers/safety_admin.js \
  h5-backend/controllers/training.js \
  h5-backend/controllers/user_manage.js \
  h5-backend/controllers/workshop_admin.js \
  h5-backend/models/index.js \
  h5-backend/routes/api.js \
  h5-frontend/dist
echo "   ✅ 打包完成"

# 步骤 3: 上传
echo ""
echo "☁️  [3/4] 正在上传到服务器..."
$SCP "$TMP_ZIP" root@$SERVER:/root/
echo "   ✅ 上传完成"

# 步骤 4: 远程执行（拆分为多条命令，避免 heredoc 兼容问题）
echo ""
echo "🔄 [4/4] 正在远程部署..."

$SSH "cd /root && unzip -q -o /root/exam_settings_update.zip -d exam_settings_tmp"
echo "   → 解压完成"

$SSH "cp -f /root/exam_settings_tmp/h5-backend/controllers/application.js  /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/exam.js          /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/safety_admin.js /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/training.js       /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/user_manage.js    /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/workshop_admin.js /root/safe_project/h5-backend/controllers/ && \
      cp -f /root/exam_settings_tmp/h5-backend/models/index.js              /root/safe_project/h5-backend/models/ && \
      cp -f /root/exam_settings_tmp/h5-backend/routes/api.js                /root/safe_project/h5-backend/routes/"
echo "   → 后端文件同步完成 (/root/safe_project)"

$SSH "cp -f /root/exam_settings_tmp/h5-backend/controllers/application.js  /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/exam.js          /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/safety_admin.js /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/training.js       /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/user_manage.js    /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/controllers/workshop_admin.js /var/www/safe_project/h5-backend/controllers/ 2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/models/index.js              /var/www/safe_project/h5-backend/models/     2>/dev/null; \
      cp -f /root/exam_settings_tmp/h5-backend/routes/api.js                /var/www/safe_project/h5-backend/routes/     2>/dev/null; \
      echo ok"
echo "   → 后端文件同步完成 (/var/www/safe_project)"

$SSH "cp -rf /root/exam_settings_tmp/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/ 2>/dev/null || \
      cp -rf /root/exam_settings_tmp/h5-frontend/dist/* /root/safe_project/h5-frontend/dist/"
echo "   → 前端静态文件同步完成"

$SSH "cd /root/safe_project/h5-backend && pm2 restart h5-backend && pm2 save"
echo "   → 后端服务已重启"

$SSH "rm -rf /root/exam_settings_tmp /root/exam_settings_update.zip"
echo "   → 临时文件已清理"

echo ""
echo "============================================================"
echo "🎉 部署成功！"
echo "   ✅ 考试设置功能已上线"
echo "   ✅ 培训视频现在从数据库读取（后台上传即生效）"
echo "============================================================"

$SSH "pm2 list"
