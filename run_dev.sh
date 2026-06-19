#!/bin/bash

# =====================================================
# 🚀 一键全自动开发环境启动脚本
# 以后只需运行这一个文件，其他什么都不用做！
# =====================================================

PROJECT_DIR="/Users/cml/Documents/20260105153022_migrant_1772376920121"
ADMIN_PHONE="18796245711"  # ← 超级管理员手机号，如需更改在这里改

echo ""
echo "================================================="
echo "💻 铁前总厂监护人系统 - 本地开发环境"
echo "================================================="

# ── 步骤 1: 启动本地 MongoDB（如果没在跑）──────────────
echo ""
echo "🗄  [1/3] 正在检查本地数据库状态..."
if ! pgrep -x "mongod" > /dev/null 2>&1; then
  echo "   MongoDB 未运行，正在启动..."
  brew services start mongodb-community 2>/dev/null || \
  brew services start mongodb-community@7.0 2>/dev/null || \
  mongod --fork --logpath /tmp/mongod.log --dbpath /usr/local/var/mongodb 2>/dev/null
  sleep 2
fi

# 等待 MongoDB 端口就绪
for i in {1..10}; do
  if nc -z 127.0.0.1 27017 2>/dev/null; then
    echo "   ✅ 数据库已就绪"
    break
  fi
  sleep 1
done

# ── 步骤 2: 初始化超级管理员（如果该账号已注册但不是管理员）──
echo ""
echo "🔑 [2/3] 正在检查管理员账号..."
node "$PROJECT_DIR/h5-backend/scripts/init_admin.js" "$ADMIN_PHONE" 2>/dev/null
# 注：如果用户还没登录注册过，这里会提示"未找到"，属正常现象，登录一次后再重启就会自动升为管理员

# ── 步骤 3: 启动前后端开发服务 ─────────────────────────
echo ""
echo "🌐 [3/3] 正在启动前端 + 后端服务..."
echo "   前端预览地址: http://localhost:5173"
echo "   按 Ctrl+C 停止所有服务"
echo ""

cd "$PROJECT_DIR"
npx concurrently --kill-others --names "后端,前端" \
  --prefix-colors "cyan,magenta" \
  "cd h5-backend && node server.js" \
  "cd h5-frontend && npm run dev"
