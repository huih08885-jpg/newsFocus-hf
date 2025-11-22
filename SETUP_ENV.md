# 环境变量设置指南

## 快速设置

### 开发环境（PostgreSQL 11）

1. **创建 `.env.local` 文件**（在项目根目录）：
```bash
# 开发环境配置
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"
```

2. **创建 `prisma/.env` 文件**（在 prisma 目录）：
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
```

### 生产环境（Neon PostgreSQL）

#### 方式一：在 Vercel 环境变量中配置（推荐）

1. 进入 Vercel Dashboard → 项目设置 → Environment Variables
2. 添加以下环境变量：

```env
# 数据库连接（使用连接池，推荐用于应用）
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 直接连接（用于迁移等长连接操作）
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
CRON_SECRET="your-random-secret-key"
```

#### 方式二：使用本地 .env.local 文件（用于本地测试 Neon）

创建 `.env.local` 文件：

```env
# Neon 数据库连接（生产环境）
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

NODE_ENV="production"
```

**⚠️ 重要：** 不要将包含真实密码的 `.env.local` 文件提交到 Git！

#### Neon 连接字符串说明

Neon 提供两种连接方式：

1. **连接池连接**（`-pooler` 端点）- 推荐用于应用
   - 格式：`postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`
   - 适合高并发应用，性能更好

2. **直接连接**（非连接池端点）- 用于迁移
   - 格式：`postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`
   - 适合长时间操作，如数据库迁移

详细配置说明请参考 [NEON_SETUP.md](./NEON_SETUP.md)

## 环境变量文件说明

### 开发环境文件

**`.env.local`** - 本地开发环境配置（不会被 Git 跟踪）
```env
# 数据库配置
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"

# 可选：通知渠道配置
FEISHU_WEBHOOK_URL=""
DINGTALK_WEBHOOK_URL=""
# ... 其他配置
```

**`prisma/.env`** - Prisma 专用环境变量（可选，如果设置了会覆盖根目录的）
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
```

### 生产环境变量

在部署平台（如 Vercel）的环境变量设置中配置：

**必需变量：**
- `DATABASE_URL` - Neon 数据库连接字符串
- `NODE_ENV` - 设置为 `production`

**可选变量：**
- `KV_REST_API_URL` - Vercel KV URL
- `KV_REST_API_TOKEN` - Vercel KV Token
- 各种通知渠道配置

## 数据库连接字符串格式

### PostgreSQL 11（开发环境）
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=public
```

示例：
```
postgresql://postgres:mypassword@localhost:5432/newsfocus_dev?schema=public
```

### Neon PostgreSQL（生产环境）
```
postgresql://[用户名]:[密码]@[端点].neon.tech/[数据库名]?sslmode=require
```

示例：
```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/newsfocus?sslmode=require
```

## 验证配置

### 检查环境变量
```bash
# 开发环境
node -e "console.log(process.env.DATABASE_URL)"

# 或在代码中
console.log(process.env.NODE_ENV)
console.log(process.env.DATABASE_URL?.includes('neon.tech') ? 'Neon' : 'PostgreSQL')
```

### 测试数据库连接
```bash
# 使用 Prisma Studio
pnpm db:studio

# 或使用 psql
psql $DATABASE_URL
```

## 注意事项

1. **`.env.local` 文件不会被 Git 跟踪**，确保不要提交包含真实密码的文件
2. **生产环境**的数据库凭证应通过部署平台的环境变量配置
3. **开发环境**使用本地 PostgreSQL 11，**生产环境**使用 Neon PostgreSQL
4. 确保数据库连接字符串格式正确，特别是 SSL 模式（Neon 需要 `sslmode=require`）

## 故障排除

### 问题：无法连接到数据库

1. 检查数据库服务是否运行：
```bash
# PostgreSQL
pg_isready

# 或检查端口
lsof -i :5432
```

2. 检查连接字符串格式是否正确
3. 检查用户名和密码是否正确
4. 检查数据库是否存在

### 问题：Neon 连接失败

1. 确保连接字符串包含 `sslmode=require`
2. 检查 Neon 项目的网络访问设置
3. 验证 IP 白名单（如果设置了）

## 更多信息

详细的环境配置说明请参考 [ENVIRONMENT.md](./ENVIRONMENT.md)

