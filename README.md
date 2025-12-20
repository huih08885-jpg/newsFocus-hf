# NewsFocus - 新闻热点聚合系统

基于 Next.js + Neon PostgreSQL 的新闻热点监控、筛选、分析和推送系统。

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- pnpm 8+（推荐）或 npm/yarn
- PostgreSQL 11+（开发环境）或 Neon 账户（生产环境）

### 安装依赖

```bash
pnpm install
```

### 环境配置

#### 开发环境（PostgreSQL 11）

1. 复制环境变量文件：
```bash
cp .env.local.example .env.local
```

2. 编辑 `.env.local`，配置本地 PostgreSQL 数据库：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"
```

3. 初始化数据库：
```bash
# 生成 Prisma 客户端
pnpm db:generate

# 运行数据库迁移
pnpm db:migrate

# 填充种子数据
pnpm db:seed
```

#### 生产环境（Neon PostgreSQL）

1. **获取 Neon 连接信息**
   - 登录 [Neon Console](https://console.neon.tech/)
   - 复制连接字符串（推荐使用连接池连接）

2. **配置环境变量**
   
   **在 Vercel 中配置（推荐）：**
   ```env
   DATABASE_URL="postgresql://neondb_owner:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
   DATABASE_URL_UNPOOLED="postgresql://neondb_owner:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
   NODE_ENV="production"
   ```
   
   **本地测试（可选）：**
   - 创建 `.env.local` 文件
   - 填入 Neon 连接信息
   - ⚠️ 不要提交到 Git！

3. **初始化数据库**
   ```bash
   # 使用 SQL 脚本
   psql $DATABASE_URL_UNPOOLED -f sql/init-prod.sql
   
   # 或使用 Prisma Migrate
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed
   ```

详细配置请参考 [NEON_SETUP.md](./NEON_SETUP.md)

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 📁 项目结构

```
newsFocus-hf/
├── app/                    # Next.js App Router 页面和 API
│   ├── api/               # API 路由
│   ├── news/              # 新闻相关页面
│   ├── analytics/         # 数据分析页面
│   ├── settings/          # 设置页面
│   └── ...
├── components/            # React 组件
│   ├── ui/               # UI 基础组件
│   ├── charts/           # 图表组件
│   └── layout/           # 布局组件
├── lib/                   # 工具库
│   ├── db/               # 数据库配置
│   └── services/         # 业务服务
├── prisma/                # Prisma 配置
│   ├── schema.prisma     # 数据库模型
│   └── seed.ts           # 种子数据
├── scripts/               # 脚本文件
└── public/                # 静态资源
```

## 🗄️ 数据库

### 开发环境
- **数据库**：PostgreSQL 11
- **连接**：本地数据库服务器

### 生产环境
- **数据库**：Neon PostgreSQL（Serverless）
- **连接**：通过环境变量配置

详细配置请参考：
- [环境配置文档](./ENVIRONMENT.md)
- [Neon 数据库配置指南](./NEON_SETUP.md)
- [环境变量设置指南](./SETUP_ENV.md)

## 📝 可用脚本

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器

# 数据库
pnpm db:generate      # 生成 Prisma 客户端
pnpm db:pull          # 从数据库拉取结构（Database First）
pnpm db:sync          # 同步数据库结构并生成客户端（推荐）
pnpm db:migrate       # 运行数据库迁移（开发）
pnpm db:migrate:deploy # 部署数据库迁移（生产）
pnpm db:studio        # 打开 Prisma Studio
pnpm db:seed          # 填充种子数据

# 设置
pnpm setup:dev        # 设置开发环境
pnpm setup:prod       # 设置生产环境
```

## 🔧 配置

### 环境变量

详见 [ENVIRONMENT.md](./ENVIRONMENT.md)

### 数据库迁移

```bash
# 创建新迁移
pnpm db:migrate

# 部署迁移（生产环境）
pnpm db:migrate:deploy
```

## 📚 文档

- [系统概述](./01-系统概述.md)
- [架构设计](./02-架构设计.md)
- [核心模块设计](./03-核心模块设计.md)
- [数据模型设计](./04-数据模型设计.md)
- [接口设计](./05-接口设计.md)
- [流程设计](./06-流程设计.md)
- [部署架构](./07-部署架构.md)
- [安全设计](./08-安全设计.md)
- [性能设计](./09-性能设计.md)
- [扩展性设计](./10-扩展性设计.md)
- [页面设计文档](./11-页面设计文档.md)
- [环境配置](./ENVIRONMENT.md)
- [Neon 数据库配置指南](./NEON_SETUP.md)
- [环境变量设置指南](./SETUP_ENV.md)
- [项目状态](./PROJECT_STATUS.md)
- [检查清单](./CHECKLIST.md)

## 🚀 部署

### Vercel 部署

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量（特别是 `DATABASE_URL`）
3. 部署

Vercel 会自动：
- 运行 `prisma generate`
- 运行 `prisma migrate deploy`

### 其他平台

参考 [部署架构文档](./07-部署架构.md)

## 🛠️ 技术栈

- **框架**：Next.js 14 (App Router)
- **语言**：TypeScript
- **数据库**：PostgreSQL (开发) / Neon PostgreSQL (生产)
- **ORM**：Prisma
- **UI**：Tailwind CSS + shadcn/ui
- **图表**：Recharts
- **部署**：Vercel

## 📄 许可证

MIT
