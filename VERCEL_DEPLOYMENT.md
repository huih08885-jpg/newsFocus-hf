# Vercel 部署配置指南

## ⚠️ Hobby 计划限制

Vercel Hobby（免费）计划对 Cron Jobs 的限制：
- ✅ 每天只能运行一次 cron 任务
- ❌ 不支持每小时或更频繁的执行

## 🔧 解决方案

### 方案 1：修改为每天运行一次（推荐，适合 Hobby 计划）

更新 `vercel.json` 中的 cron 配置：

```json
{
  "crons": [
    {
      "path": "/api/cron/crawl",
      "schedule": "0 9 * * *"  // 每天上午 9 点运行
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"  // 每天凌晨 2 点运行（保持不变）
    }
  ]
}
```

### 方案 2：升级到 Pro 计划

如果需要更频繁的爬取（每6小时一次），可以：
- 升级到 Vercel Pro 计划（$20/月）
- 解锁所有 Cron Jobs 功能

### 方案 3：使用外部 Cron 服务

如果不想升级，可以使用外部服务触发爬取：
- GitHub Actions（免费）
- EasyCron（免费计划）
- Cron-job.org（免费）

## 📋 Vercel 部署配置

### 1. Project Name（项目名称）
```
news-focus-hf
```
或保持默认值

### 2. Framework Preset（框架预设）
```
Next.js
```
Vercel 会自动检测

### 3. Root Directory（根目录）
```
./
```
保持默认值（项目根目录）

### 4. Build and Output Settings（构建和输出设置）

点击展开后，配置如下：

**Build Command:**
```
prisma generate && next build
```

**Output Directory:**
```
.next
```
（Next.js 默认，通常不需要修改）

**Install Command:**
```
pnpm install
```
或使用默认的 `npm install`（如果使用 npm）

### 5. Environment Variables（环境变量）

点击展开后，添加以下环境变量：

#### 必需变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `你的 Neon 数据库连接字符串` | Neon 数据库连接（使用连接池端点） |
| `NODE_ENV` | `production` | 生产环境标识 |

#### 可选变量（根据需求添加）

| 变量名 | 说明 |
|--------|------|
| `CRON_SECRET` | Cron 任务安全密钥（可选，用于保护 cron 端点） |
| `KV_REST_API_URL` | Vercel KV URL（如果使用缓存） |
| `KV_REST_API_TOKEN` | Vercel KV Token |
| `FEISHU_WEBHOOK_URL` | 飞书 Webhook URL |
| `DINGTALK_WEBHOOK_URL` | 钉钉 Webhook URL |
| `NEXT_PUBLIC_APP_URL` | 应用公开 URL（用于 CORS） |

#### 获取 Neon 数据库连接字符串

1. 登录 [Neon Console](https://console.neon.tech/)
2. 选择你的项目
3. 在 "Connection Details" 中：
   - **应用连接**：使用 `-pooler` 端点的连接字符串
   - 格式：`postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`

### 6. Cron Jobs 配置

**注意**：Hobby 计划限制为每天运行一次

#### 推荐配置（每天运行）

```json
{
  "crons": [
    {
      "path": "/api/cron/crawl",
      "schedule": "0 9 * * *"  // 每天上午 9 点（UTC）
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"  // 每天凌晨 2 点（UTC）
    }
  ]
}
```

#### Cron 表达式说明

- `0 9 * * *` - 每天 09:00 UTC
- `0 2 * * *` - 每天 02:00 UTC
- `0 */6 * * *` - 每 6 小时（**Hobby 计划不支持**）

**时区转换**：
- UTC 09:00 = 北京时间 17:00（UTC+8）
- UTC 02:00 = 北京时间 10:00（UTC+8）

## 🚀 部署步骤

### 第一步：修改 vercel.json（解决 Cron 限制）

更新 cron 配置为每天运行一次：

```json
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "crons": [
    {
      "path": "/api/cron/crawl",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ],
  "env": {
    "PRISMA_GENERATE_DATAPROXY": "false"
  }
}
```

### 第二步：在 Vercel 中配置

1. **Project Name**: `news-focus-hf`（或自定义）
2. **Framework Preset**: `Next.js`（自动检测）
3. **Root Directory**: `./`（默认）
4. **Build Command**: `prisma generate && next build`
5. **Install Command**: `pnpm install`
6. **Environment Variables**: 添加 `DATABASE_URL` 和其他需要的变量

### 第三步：部署

点击 "Deploy" 按钮，等待部署完成。

## 📝 部署后检查

1. **检查部署日志**：
   - 确认 `prisma generate` 成功
   - 确认 `next build` 成功

2. **检查数据库连接**：
   - 访问应用首页
   - 检查是否能正常加载数据

3. **检查 Cron Jobs**：
   - 在 Vercel Dashboard → Settings → Cron Jobs
   - 确认 cron 任务已配置
   - 等待第一次执行（根据 schedule）

## 🔄 如果需要更频繁的爬取

### 选项 1：手动触发

访问 `/api/crawl` 端点手动触发爬取：
```bash
curl -X POST https://your-app.vercel.app/api/crawl
```

### 选项 2：使用 GitHub Actions

创建 `.github/workflows/crawl.yml`：

```yaml
name: Crawl News

on:
  schedule:
    - cron: '0 */6 * * *'  # 每6小时
  workflow_dispatch:  # 手动触发

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Crawl
        run: |
          curl -X POST ${{ secrets.VERCEL_APP_URL }}/api/crawl \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 选项 3：升级到 Pro 计划

升级后可以使用 `0 */6 * * *` 每6小时运行一次。

## ❓ 常见问题

### Q: Cron 任务没有执行？
A: 
1. 检查 Vercel Dashboard → Cron Jobs 是否显示任务
2. 确认 schedule 格式正确
3. Hobby 计划需要等待至少 24 小时才能看到执行记录

### Q: 如何修改爬取频率？
A: 
- Hobby 计划：只能每天一次，修改 `vercel.json` 中的 schedule
- Pro 计划：可以任意频率，支持 `*/6 * * * *` 等表达式

### Q: 数据库迁移如何执行？
A: 
- Vercel 会自动运行 `prisma generate`
- 需要手动运行迁移：`pnpm db:migrate:deploy`
- 或使用 Vercel CLI：`vercel env pull` 然后本地运行迁移

## 📚 相关文档

- [Vercel Cron Jobs 文档](https://vercel.com/docs/cron-jobs)
- [Neon 连接指南](./NEON_SETUP.md)
- [环境变量配置](./ENVIRONMENT.md)

