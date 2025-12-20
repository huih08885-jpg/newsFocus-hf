# 环境变量文件设置说明

## Prisma CLI 环境变量读取规则

Prisma CLI **只自动读取 `.env` 文件**，不会读取 `.env.local`。

## 解决方案

### 方案 1: 创建 `.env` 文件（推荐用于 Prisma CLI）

在项目根目录创建 `.env` 文件，内容与 `.env.local` 相同：

```bash
DATABASE_URL=postgresql://postgres:123456789@localhost:5432/newsFocus-hf
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="dev-secret-key-change-in-production"
```

**注意**：`.env` 文件通常会被提交到版本控制（如果包含敏感信息，可以添加到 `.gitignore`）

### 方案 2: 使用 PowerShell 脚本

使用已创建的 PowerShell 脚本，它会自动加载 `.env.local`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync-db-schema.ps1
```

### 方案 3: 设置系统环境变量

在 Windows 系统环境变量中设置 `DATABASE_URL`。

## 文件用途说明

- **`.env.local`**: Next.js 开发服务器自动读取（优先级最高）
- **`.env`**: Prisma CLI 自动读取，Next.js 也会读取（优先级较低）
- **`.env.production`**: 生产环境使用

## 推荐配置

同时保留两个文件：
- `.env.local` - 用于 Next.js 开发服务器（包含敏感信息，不提交到 git）
- `.env` - 用于 Prisma CLI 和工具（可以提交到 git，但不要包含真实密码）

