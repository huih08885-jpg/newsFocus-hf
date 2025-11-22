# Neon 数据库配置指南

本文档说明如何将 Neon PostgreSQL 数据库整合到项目中。

## 📋 前置要求

- Neon 账户（免费注册：https://neon.tech）
- Neon 项目已创建
- 数据库连接字符串

## 🔧 配置步骤

### 步骤 1: 获取 Neon 连接信息

1. 登录 [Neon Console](https://console.neon.tech/)
2. 选择你的项目
3. 在项目设置中找到 "Connection Details"
4. 复制连接字符串

Neon 提供两种连接方式：

- **连接池连接**（推荐用于应用）：使用 `-pooler` 后缀的端点
- **直接连接**（用于迁移等）：不使用连接池的端点

### 步骤 2: 配置环境变量

#### 开发环境（本地测试 Neon）

创建 `.env.local` 文件：

```bash
cp .env.production.example .env.local
```

编辑 `.env.local`，填入你的 Neon 连接信息：

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
NODE_ENV="development"
```

#### 生产环境（Vercel）

在 Vercel 项目设置中添加环境变量：

1. 进入 Vercel Dashboard
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加以下变量：

**必需变量：**
- `DATABASE_URL` - Neon 连接池连接字符串（推荐）
- `NODE_ENV` - 设置为 `production`

**可选变量：**
- `DATABASE_URL_UNPOOLED` - 直接连接字符串（用于迁移）
- `CRON_SECRET` - 定时任务安全密钥
- 其他通知渠道配置

### 步骤 3: 初始化数据库

#### 方式一：使用 SQL 脚本（推荐）

```bash
# 使用连接池连接执行初始化脚本
psql "postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" -f sql/init-prod.sql
```

**注意：** 对于需要长连接的操作（如迁移），建议使用非连接池连接：

```bash
# 使用直接连接执行初始化脚本
psql "postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" -f sql/init-prod.sql
```

#### 方式二：使用 Prisma Migrate（推荐）

```bash
# 设置环境变量
export DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 生成 Prisma 客户端
npm run db:generate

# 运行迁移
npm run db:migrate:deploy

# 填充种子数据
npm run db:seed
```

#### 方式三：使用 Neon Web Console

1. 登录 Neon Console
2. 进入项目的 **SQL Editor**
3. 复制 `sql/init-prod.sql` 的内容
4. 粘贴到 SQL Editor
5. 点击 **Run** 执行

### 步骤 4: 验证连接

```bash
# 使用 Prisma Studio 查看数据
npm run db:studio

# 或使用 psql 命令行
psql "postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

## 🔐 安全注意事项

### ⚠️ 重要安全提示

1. **永远不要提交包含真实密码的文件到 Git**
   - `.env.local` 已在 `.gitignore` 中
   - `.env.production.example` 是模板文件，不包含真实密码

2. **使用环境变量存储敏感信息**
   - 开发环境：使用 `.env.local`（不提交到 Git）
   - 生产环境：使用 Vercel 环境变量（加密存储）

3. **定期轮换密码**
   - 在 Neon Console 中可以重置数据库密码
   - 重置后记得更新所有环境变量

4. **使用 SSL 连接**
   - Neon 要求使用 `sslmode=require`
   - 确保连接字符串包含 `?sslmode=require`

## 📝 连接字符串说明

### 连接池连接（推荐用于应用）

```
postgresql://用户名:密码@端点-pooler.区域.aws.neon.tech/数据库名?sslmode=require
```

**特点：**
- 使用连接池，适合高并发应用
- 连接数有限制，但性能更好
- 推荐用于 Next.js 应用

### 直接连接（用于迁移）

```
postgresql://用户名:密码@端点.区域.aws.neon.tech/数据库名?sslmode=require
```

**特点：**
- 不使用连接池，直接连接数据库
- 适合迁移、备份等长时间操作
- 推荐用于 `prisma migrate` 命令

## 🚀 Vercel 部署配置

### 自动迁移

Vercel 在部署时会自动运行：

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "next build && prisma migrate deploy"
  }
}
```

### 手动迁移

如果需要手动运行迁移：

```bash
# 使用 Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

## 🔍 故障排除

### 问题 1: 连接超时

**错误：** `Connection timeout`

**解决方案：**
- 检查网络连接
- 确认 Neon 项目的网络访问设置
- 检查 IP 白名单（如果设置了）

### 问题 2: SSL 错误

**错误：** `SSL connection required`

**解决方案：**
- 确保连接字符串包含 `?sslmode=require`
- 检查防火墙设置

### 问题 3: 迁移失败

**错误：** `Migration failed`

**解决方案：**
- 使用非连接池连接（`DATABASE_URL_UNPOOLED`）
- 检查数据库权限
- 查看 Neon Console 的日志

### 问题 4: 连接数限制

**错误：** `Too many connections`

**解决方案：**
- 使用连接池连接（`-pooler` 端点）
- 检查连接是否正确关闭
- 考虑升级 Neon 计划

## 📚 相关文档

- [Neon 官方文档](https://neon.tech/docs)
- [Prisma 迁移文档](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [项目环境配置文档](./ENVIRONMENT.md)
- [数据库初始化 SQL 脚本](./sql/README.md)

## 💡 最佳实践

1. **开发环境**：使用本地 PostgreSQL 11
2. **生产环境**：使用 Neon PostgreSQL
3. **迁移操作**：使用直接连接（非连接池）
4. **应用连接**：使用连接池连接
5. **环境变量**：使用 `.env.local`（开发）和 Vercel 环境变量（生产）

## 🎯 快速开始

```bash
# 1. 复制环境变量模板
cp .env.production.example .env.local

# 2. 编辑 .env.local，填入你的 Neon 连接信息

# 3. 初始化数据库
psql $DATABASE_URL -f sql/init-prod.sql

# 4. 生成 Prisma 客户端
npm run db:generate

# 5. 验证连接
npm run db:studio
```

