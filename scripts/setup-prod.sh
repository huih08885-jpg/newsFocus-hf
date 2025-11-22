#!/bin/bash

# 生产环境设置脚本（用于 CI/CD）

echo "🚀 设置生产环境..."

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 环境变量未设置"
    exit 1
fi

# 检查是否是 Neon 数据库
if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
    echo "✅ 检测到 Neon PostgreSQL 数据库"
else
    echo "⚠️  警告: 未检测到 Neon 数据库连接字符串"
fi

# 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
npx prisma migrate deploy

# 填充种子数据（可选）
if [ "$RUN_SEED" = "true" ]; then
    echo "🌱 填充种子数据..."
    npx prisma db seed
fi

echo "✅ 生产环境设置完成！"

