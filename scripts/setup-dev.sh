#!/bin/bash

# 开发环境设置脚本

echo "🚀 设置开发环境..."

# 检查 .env.local 文件
if [ ! -f .env.local ]; then
    echo "📝 创建 .env.local 文件..."
    cp .env.local.example .env.local
    echo "✅ 请编辑 .env.local 文件，填入数据库连接信息"
fi

# 检查 PostgreSQL 是否运行
echo "🔍 检查 PostgreSQL 连接..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL 客户端已安装"
else
    echo "⚠️  未检测到 PostgreSQL 客户端，请确保 PostgreSQL 11 已安装并运行"
fi

# 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
npx prisma migrate dev --name init

# 填充种子数据
echo "🌱 填充种子数据..."
npx prisma db seed

echo "✅ 开发环境设置完成！"
echo "📝 请确保："
echo "   1. PostgreSQL 11 已安装并运行"
echo "   2. .env.local 中的 DATABASE_URL 配置正确"
echo "   3. 数据库已创建"

