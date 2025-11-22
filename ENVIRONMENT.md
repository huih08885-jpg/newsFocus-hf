# 环境配置文档

## 环境区分

本项目支持两种环境配置：
- **开发环境**：使用本地 PostgreSQL 11
- **生产环境**：使用 Neon PostgreSQL（Serverless）

## 数据库配置

### 开发环境（PostgreSQL 11）

**要求：**
- PostgreSQL 11 或更高版本
- 本地数据库服务器运行中

**配置步骤：**

1. 安装 PostgreSQL 11
   ```bash
   # macOS (使用 Homebrew)
   brew install postgresql@11
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-11
   
   # Windows
   # 从 https://www.postgresql.org/download/windows/ 下载安装
   ```

2. 创建数据库
   ```bash
   # 登录 PostgreSQL
   psql -U postgres
   
   # 创建数据库
   CREATE DATABASE newsfocus_dev;
   
   # 创建用户（可选）
   CREATE USER newsfocus_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE newsfocus_dev TO newsfocus_user;
   ```

3. 配置环境变量
   ```bash
   # 复制示例文件
   cp .env.local.example .env.local
   
   # 编辑 .env.local，设置数据库连接
   DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
   ```

4. 初始化数据库
   ```bash
   # 生成 Prisma 客户端
   pnpm db:generate
   
   # 运行迁移
   pnpm db:migrate
   
   # 填充种子数据
   pnpm db:seed
   ```

### 生产环境（Neon PostgreSQL）

**要求：**
- Neon 账户（https://neon.tech）
- Neon 项目已创建

**配置步骤：**

1. **获取 Neon 连接信息**
   - 登录 [Neon Console](https://console.neon.tech/)
   - 选择项目，在 "Connection Details" 中复制连接字符串
   - Neon 提供两种连接方式：
     - **连接池连接**（`-pooler` 端点）：推荐用于应用
     - **直接连接**（非连接池）：推荐用于迁移

2. **配置环境变量**

   **在 Vercel 中配置（推荐）：**
   ```
   # 应用连接（使用连接池）
   DATABASE_URL="postgresql://neondb_owner:password@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
   
   # 迁移连接（直接连接）
   DATABASE_URL_UNPOOLED="postgresql://neondb_owner:password@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
   
   NODE_ENV="production"
   ```

   **本地测试 Neon（可选）：**
   - 创建 `.env.local` 文件
   - 填入 Neon 连接信息
   - ⚠️ 不要提交到 Git！

3. **初始化数据库**
   ```bash
   # 方式一：使用 SQL 脚本
   psql $DATABASE_URL_UNPOOLED -f sql/init-prod.sql
   
   # 方式二：使用 Prisma Migrate（推荐）
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed
   ```

4. **部署时自动运行迁移**
   - Vercel 会自动运行 `prisma migrate deploy`
   - 或手动运行迁移脚本

详细配置说明请参考 [NEON_SETUP.md](./NEON_SETUP.md)

## 环境变量说明

### 必需变量

| 变量名 | 开发环境 | 生产环境 | 说明 |
|--------|---------|---------|------|
| `DATABASE_URL` | ✅ | ✅ | 数据库连接字符串 |
| `NODE_ENV` | `development` | `production` | Node.js 环境 |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `KV_REST_API_URL` | Vercel KV URL（用于缓存） | - |
| `KV_REST_API_TOKEN` | Vercel KV Token | - |
| `FEISHU_WEBHOOK_URL` | 飞书 Webhook URL | - |
| `DINGTALK_WEBHOOK_URL` | 钉钉 Webhook URL | - |
| `WEWORK_WEBHOOK_URL` | 企业微信 Webhook URL | - |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | - |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | - |
| `EMAIL_FROM` | 发件人邮箱 | - |
| `EMAIL_PASSWORD` | 邮箱密码/授权码 | - |
| `EMAIL_TO` | 收件人邮箱（逗号分隔） | - |
| `EMAIL_SMTP_SERVER` | SMTP 服务器 | - |
| `EMAIL_SMTP_PORT` | SMTP 端口 | `587` |
| `NTFY_SERVER_URL` | ntfy 服务器 URL | `https://ntfy.sh` |
| `NTFY_TOPIC` | ntfy Topic | - |
| `NTFY_TOKEN` | ntfy Token（可选） | - |

## 数据库连接字符串格式

### PostgreSQL 11（开发环境）
```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

示例：
```
postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public
```

### Neon PostgreSQL（生产环境）

**连接池连接**（推荐用于应用）：
```
postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[database]?sslmode=require
```

示例：
```
postgresql://neondb_owner:password@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**直接连接**（推荐用于迁移）：
```
postgresql://[user]:[password]@[endpoint].[region].aws.neon.tech/[database]?sslmode=require
```

示例：
```
postgresql://neondb_owner:password@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## 快速设置

### 开发环境
```bash
# 1. 复制环境变量文件
cp .env.local.example .env.local

# 2. 编辑 .env.local，填入数据库连接信息

# 3. 运行设置脚本（macOS/Linux）
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# 或手动执行
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 生产环境（Vercel）

1. 在 Vercel 项目设置中添加环境变量：
   - `DATABASE_URL`：Neon 数据库连接字符串
   - 其他可选配置

2. 部署时 Vercel 会自动：
   - 运行 `prisma generate`
   - 运行 `prisma migrate deploy`

## 数据库迁移

### 开发环境
```bash
# 创建新迁移
pnpm db:migrate

# 重置数据库（谨慎使用）
pnpm db:migrate reset
```

### 生产环境
```bash
# 部署迁移（不会重置数据）
pnpm db:migrate deploy
```

## 常见问题

### Q: 如何切换数据库？
A: 修改 `.env.local`（开发）或环境变量（生产）中的 `DATABASE_URL`

### Q: Neon 和 PostgreSQL 11 有什么区别？
A: 
- **PostgreSQL 11**：传统数据库，需要本地安装和运行
- **Neon**：Serverless PostgreSQL，自动扩展，无需管理服务器

### Q: 可以在开发环境使用 Neon 吗？
A: 可以，但不推荐。建议开发环境使用本地 PostgreSQL 11，生产环境使用 Neon。

### Q: 如何检查数据库连接？
A: 
```bash
# 使用 Prisma Studio
pnpm db:studio

# 或使用 psql
psql $DATABASE_URL
```

## 安全注意事项

1. **永远不要**将 `.env.local` 或包含真实凭证的文件提交到 Git
2. **生产环境**的数据库凭证应通过部署平台的环境变量配置
3. 使用强密码和 SSL 连接（生产环境）
4. 定期轮换数据库密码

