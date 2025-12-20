#!/bin/bash

# Database First 工作流辅助脚本
# 用途：从数据库拉取结构并更新 Prisma schema

set -e

echo "🔄 Database First 工作流 - 同步数据库结构到 Prisma Schema"
echo ""

# 检查是否在项目根目录
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告：DATABASE_URL 环境变量未设置"
    echo "   请确保已设置数据库连接字符串"
    echo ""
fi

echo "📥 步骤 1: 从数据库拉取结构..."
npx prisma db pull

echo ""
echo "🔨 步骤 2: 生成 Prisma 客户端..."
npx prisma generate

echo ""
echo "✅ 完成！"
echo ""
echo "📝 下一步："
echo "   1. 检查 prisma/schema.prisma 的变化"
echo "   2. 如有需要，重启开发服务器"
echo "   3. 运行 'npm run dev' 启动服务器"

