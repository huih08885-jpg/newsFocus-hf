# 快速开始指南

## 🚀 5分钟快速启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置开发环境

#### 选项 A：使用设置脚本（推荐）

```bash
# macOS/Linux
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# Windows (Git Bash)
bash scripts/setup-dev.sh
```

#### 选项 B：手动设置

1. **创建 `.env.local` 文件**：
```bash
cp .env.local.example .env.local
# 然后编辑 .env.local，填入数据库连接信息
```

2. **配置数据库连接**（编辑 `.env.local`）：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"
```

3. **初始化数据库**：
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 📋 环境要求

- **Node.js** 18+
- **PostgreSQL 11+**（开发环境）或 **Neon 账户**（生产环境）
- **pnpm** 8+（推荐）或 npm/yarn

## 🔧 开发环境 vs 生产环境

### 开发环境（PostgreSQL 11）

- 使用本地 PostgreSQL 11 数据库
- 配置文件：`.env.local`
- 数据库迁移：`pnpm db:migrate`
- 详细日志：启用查询日志

### 生产环境（Neon PostgreSQL）

- 使用 Neon Serverless PostgreSQL
- 配置：通过部署平台环境变量
- 数据库迁移：`pnpm db:migrate:deploy`
- 详细日志：仅错误日志

## 📝 常用命令

```bash
# 开发
pnpm dev                    # 启动开发服务器
pnpm build                  # 构建生产版本
pnpm start                  # 启动生产服务器

# 数据库
pnpm db:generate            # 生成 Prisma 客户端
pnpm db:migrate             # 运行迁移（开发）
pnpm db:migrate:deploy      # 部署迁移（生产）
pnpm db:studio              # 打开 Prisma Studio
pnpm db:seed                # 填充种子数据

# 设置
pnpm setup:dev              # 设置开发环境
pnpm setup:prod             # 设置生产环境
```

## 🐛 常见问题

### Q: 如何创建数据库？

**PostgreSQL 11（开发环境）：**
```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE newsfocus_dev;

# 退出
\q
```

**Neon（生产环境）：**
1. 访问 https://neon.tech
2. 创建新项目
3. 复制连接字符串到环境变量

### Q: 数据库连接失败？

1. 检查数据库服务是否运行
2. 检查 `.env.local` 中的 `DATABASE_URL` 是否正确
3. 检查用户名和密码
4. 检查数据库是否存在

### Q: 如何切换环境？

修改 `.env.local`（开发）或部署平台环境变量（生产）中的 `DATABASE_URL`

## 📚 更多文档

- [环境配置文档](./ENVIRONMENT.md) - 详细的环境配置说明
- [环境变量设置](./SETUP_ENV.md) - 环境变量配置指南
- [项目状态](./PROJECT_STATUS.md) - 项目完成状态
- [检查清单](./CHECKLIST.md) - 代码检查清单

## 🎯 下一步

1. ✅ 完成环境配置
2. ✅ 初始化数据库
3. ✅ 启动开发服务器
4. 📖 阅读 [系统概述](./01-系统概述.md) 了解系统架构
5. 🔧 配置通知渠道（可选）
6. 🚀 开始开发！
