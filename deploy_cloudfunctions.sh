#!/bin/bash
# 支付宝云函数批量部署脚本
# 使用前：npm install -g @alicloud/fun 或 minidev
# 运行：bash deploy_cloudfunctions.sh

ENV_ID="env-00jy61dujbbj"
CF_DIR="$(cd "$(dirname "$0")/cloudfunctions" && pwd)"

echo "======================================"
echo " 支付宝云函数部署工具"
echo " 环境ID: $ENV_ID"
echo " 云函数目录: $CF_DIR"
echo "======================================"
echo ""

# 检查 minidev 是否安装
if command -v minidev &> /dev/null; then
  echo "✅ 检测到 minidev，使用 minidev 部署..."
  echo ""

  for dir in "$CF_DIR"/*/; do
    name=$(basename "$dir")
    echo "📦 部署: $name"
    minidev cloud fn deploy \
      --project "$CF_DIR/../" \
      --name "$name" \
      --env "$ENV_ID" && echo "   ✅ 成功" || echo "   ❌ 失败"
    echo ""
  done

else
  echo "⚠️  未检测到 minidev，请先安装："
  echo ""
  echo "   npm install -g minidev"
  echo "   然后重新运行此脚本"
  echo ""
  echo "---------------------------------------"
  echo "📌 或者使用以下步骤在 IDE 中手动部署："
  echo ""
  echo "1. 打开支付宝 IDE"
  echo "2. 顶部菜单 → 「云开发」"
  echo "3. 左侧选「云函数」"
  echo "4. 点「上传云函数」，选择各函数文件夹"
  echo ""
  echo "📌 或者在网页控制台部署："
  echo "   https://clouddev.alipay.com"
  echo "   环境ID: $ENV_ID"
  echo "---------------------------------------"
  echo ""
  echo "需要部署的云函数列表（共 $(ls "$CF_DIR" | wc -l | tr -d ' ') 个）："
  echo ""
  ls "$CF_DIR" | while read fn; do
    echo "  - $fn"
  done
fi

echo ""
echo "完成后记得在云函数控制台分别测试："
echo "  1. initDatabase（初始化数据库集合）"
echo "  2. seedTestData（创建管理员账号）"
