#!/bin/bash
# ============================================================
# 🚀 安全科功能热更新脚本
# 更新内容：教学视频管理 + 题库管理（含批量导入）
# ============================================================

set -e

SERVER_IP="47.76.215.197"
PROJECT_DIR="/Users/cml/Documents/20260105153022_migrant_1772376920121"
TMP_ZIP="/tmp/safety_feature_update.zip"

echo ""
echo "============================================================"
echo "🔧 安全科功能热更新 → 服务器 $SERVER_IP"
echo "============================================================"

# ── 步骤 1: 构建前端 ──────────────────────────────────────
echo ""
echo "📦 [1/4] 正在构建前端 (npm run build)..."
cd "$PROJECT_DIR/h5-frontend"
npm run build
echo "   ✅ 前端构建完成"

# ── 步骤 2: 打包变更文件 ──────────────────────────────────
echo ""
echo "🗜  [2/4] 正在打包更新文件..."
cd "$PROJECT_DIR"
rm -f "$TMP_ZIP"

zip -r "$TMP_ZIP" \
  h5-backend/controllers/safety_admin.js \
  h5-backend/models/index.js \
  h5-backend/routes/api.js \
  h5-frontend/dist

echo "   ✅ 打包完成：$TMP_ZIP"

# ── 步骤 3: 上传 ──────────────────────────────────────────
echo ""
echo "☁️  [3/4] 正在上传到服务器（可能需要输入密码）..."
scp "$TMP_ZIP" root@$SERVER_IP:/root/
echo "   ✅ 上传完成"

# ── 步骤 4: 远程部署 ─────────────────────────────────────
echo ""
echo "🔄 [4/4] 正在远程部署（可能需要输入密码）..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'EOF'
  set -e
  echo "=> 解压更新包..."
  cd /root
  unzip -q -o safety_feature_update.zip -d safety_update_tmp

  echo "=> 同步后端文件..."
  cp -f safety_update_tmp/h5-backend/controllers/safety_admin.js /root/safe_project/h5-backend/controllers/
  cp -f safety_update_tmp/h5-backend/models/index.js              /root/safe_project/h5-backend/models/
  cp -f safety_update_tmp/h5-backend/routes/api.js                /root/safe_project/h5-backend/routes/

  echo "=> 同步前端静态文件..."
  cp -rf safety_update_tmp/h5-frontend/dist/* /var/www/safe_project/h5-frontend/dist/ 2>/dev/null || \
  cp -rf safety_update_tmp/h5-frontend/dist/* /root/safe_project/h5-frontend/dist/

  echo "=> 重启后端服务..."
  cd /root/safe_project/h5-backend
  pm2 restart h5-backend
  pm2 save

  echo "=> 清理临时文件..."
  rm -rf /root/safety_update_tmp /root/safety_feature_update.zip

  echo ""
  echo "============================================================"
  echo "🎉 部署成功！安全科视频+题库管理功能已上线"
  echo "============================================================"
  pm2 list
EOF

echo ""
echo "✅ 全部完成！请在浏览器刷新后台页面验证。"
