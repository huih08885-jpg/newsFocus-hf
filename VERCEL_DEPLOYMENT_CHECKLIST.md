# Vercel 部署适配性检查清单

## ✅ 已检查并修复的问题

### 1. 类型错误
- ✅ 修复了 `KeywordGroup` 类型不统一的问题
- ✅ 修复了 `CrawlProgress.currentStep` 类型错误
- ✅ 修复了 `lib/auth.ts` 中 `session` 可能为 `null` 的问题

### 2. Prisma 客户端配置
- ✅ Prisma 客户端已正确配置，支持 Neon 数据库
- ✅ 使用全局变量避免重复创建实例（开发环境）
- ✅ 生产环境自动使用连接池

### 3. 缓存服务
- ✅ 修复了 Vercel KV 异步初始化问题
- ✅ 添加了初始化状态检查
- ✅ 内存缓存作为后备方案

### 4. API 路由
- ✅ 所有 API 路由都使用 `async/await`
- ✅ 错误处理完善
- ✅ 返回格式统一

### 5. 中间件
- ✅ 路由保护逻辑正确
- ✅ 公开路由配置完整
- ✅ API 路由保护正确

### 6. 环境变量
- ✅ 所有环境变量都有默认值或可选检查
- ✅ 没有硬编码的敏感信息

## 📋 Vercel 部署配置

### vercel.json
```json
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs",
  "installCommand": "npm ci",
  "crons": [
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

### 必需的环境变量

在 Vercel Dashboard → Settings → Environment Variables 中配置：

#### 必需变量
- `DATABASE_URL` - Neon PostgreSQL 连接字符串（必需）
  - 格式：`postgresql://user:password@host.neon.tech/dbname?sslmode=require`
  - 使用 Neon 的连接池端点（`-pooler`）

#### 可选变量
- `NEXT_PUBLIC_APP_URL` - 应用公共 URL（可选，用于 CORS）
- `CRON_SECRET` - Cron 任务安全密钥（可选，但推荐）
- `KV_REST_API_URL` - Vercel KV URL（可选，用于缓存）
- `KV_REST_API_TOKEN` - Vercel KV Token（可选）

### 通知相关环境变量（可选）
- `FEISHU_WEBHOOK_URL`
- `DINGTALK_WEBHOOK_URL`
- `WEWORK_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `EMAIL_FROM`
- `EMAIL_PASSWORD`
- `EMAIL_SMTP_SERVER`
- `EMAIL_SMTP_PORT`
- `NTFY_SERVER_URL`
- `NTFY_TOPIC`
- `NTFY_TOKEN`

## 🔍 代码适配性检查

### ✅ 已适配的功能

1. **无文件系统操作**
   - ✅ 没有使用 `fs` 模块
   - ✅ 没有文件读写操作

2. **环境变量使用**
   - ✅ 所有环境变量都有适当的检查
   - ✅ 使用 `process.env` 访问环境变量

3. **异步操作**
   - ✅ 所有 API 路由都是异步的
   - ✅ 使用 `async/await` 处理异步操作

4. **数据库连接**
   - ✅ 使用 Prisma ORM，兼容 Neon PostgreSQL
   - ✅ 支持连接池
   - ✅ 优雅关闭连接

5. **静态资源**
   - ✅ 没有使用 `public` 目录外的静态文件
   - ✅ 图片使用 Next.js Image 组件

6. **客户端/服务器端分离**
   - ✅ 所有客户端组件都有 `"use client"` 指令
   - ✅ 服务器组件默认使用

7. **API 路由**
   - ✅ 所有 API 路由都在 `app/api` 目录下
   - ✅ 使用 Next.js 13+ App Router

8. **中间件**
   - ✅ 使用 Next.js Middleware
   - ✅ 正确配置了路由匹配

9. **构建配置**
   - ✅ `next.config.js` 配置正确
   - ✅ TypeScript 配置正确
   - ✅ PostCSS 和 Tailwind 配置正确

## ⚠️ 注意事项

### 1. 数据库初始化
部署后需要初始化数据库：
- 在 Neon SQL Editor 中执行 `sql/init-prod.sql`
- 或使用 Prisma Migrate: `npx prisma migrate deploy`

### 2. Cron Jobs
- Hobby 计划只支持每天运行一次
- 当前配置：清理任务每天 02:00 UTC
- 如果需要更频繁的爬取，需要升级到 Pro 计划

### 3. 函数超时
- Hobby 计划：10 秒（API Routes）
- Pro 计划：60 秒
- 爬取任务可能超过 10 秒，建议：
  - 使用后台任务模式（已实现）
  - 或升级到 Pro 计划

### 4. 内存限制
- Hobby 计划：1024 MB
- Pro 计划：1024 MB（可升级）
- 当前应用应该足够

### 5. 环境变量
- 确保所有必需的环境变量都已配置
- 环境变量区分 Production、Preview、Development

## 🚀 部署步骤

1. **准备代码**
   ```bash
   git add .
   git commit -m "准备 Vercel 部署"
   git push
   ```

2. **在 Vercel 中创建项目**
   - 访问 https://vercel.com/dashboard
   - 点击 "New Project"
   - 导入 GitHub 仓库
   - Framework Preset: Next.js（自动检测）

3. **配置环境变量**
   - 在项目设置中添加所有必需的环境变量
   - 确保 `DATABASE_URL` 正确配置

4. **部署**
   - Vercel 会自动检测并部署
   - 检查构建日志确认成功

5. **初始化数据库**
   - 在 Neon SQL Editor 中执行 `sql/init-prod.sql`
   - 或使用 Prisma Migrate

6. **验证部署**
   - 访问应用 URL
   - 测试登录功能
   - 测试爬取功能
   - 检查 Cron 任务

## 📊 性能优化建议

1. **数据库连接**
   - ✅ 使用 Neon 连接池端点
   - ✅ Prisma 客户端复用

2. **缓存**
   - ✅ 使用 Vercel KV（如果配置）
   - ✅ 内存缓存作为后备

3. **API 响应**
   - ✅ 使用缓存减少数据库查询
   - ✅ 分页查询

4. **静态资源**
   - ✅ 使用 Next.js Image 优化
   - ✅ 静态资源 CDN 加速

## 🔐 安全建议

1. **环境变量**
   - ✅ 不在代码中硬编码敏感信息
   - ✅ 使用 Vercel 加密存储

2. **API 保护**
   - ✅ Cron 任务使用 Secret 验证
   - ✅ 受保护的路由需要登录

3. **数据库**
   - ✅ 使用 SSL 连接
   - ✅ 使用连接池

4. **CORS**
   - ✅ 配置了 CORS 头
   - ✅ 使用环境变量配置允许的来源

## ✅ 最终检查清单

- [x] 所有类型错误已修复
- [x] Prisma 客户端配置正确
- [x] 缓存服务适配 Vercel KV
- [x] API 路由兼容 Next.js App Router
- [x] 中间件配置正确
- [x] 环境变量使用正确
- [x] 没有文件系统操作
- [x] 客户端/服务器端代码分离正确
- [x] 构建配置正确
- [x] 数据库连接配置正确

## 📝 部署后验证

部署成功后，验证以下功能：

1. **基础功能**
   - [ ] 首页加载正常
   - [ ] 登录/注册功能正常
   - [ ] 多平台热点页面正常

2. **数据功能**
   - [ ] 爬取功能正常
   - [ ] 关键词匹配正常
   - [ ] 数据分析正常

3. **定时任务**
   - [ ] Cron 清理任务正常
   - [ ] 日志中可以看到任务执行

4. **性能**
   - [ ] 页面加载速度正常
   - [ ] API 响应时间正常
   - [ ] 数据库查询正常

## 🆘 故障排除

如果遇到问题：

1. **构建失败**
   - 检查构建日志
   - 确认所有依赖已安装
   - 检查 TypeScript 类型错误

2. **运行时错误**
   - 检查环境变量配置
   - 检查数据库连接
   - 查看 Vercel 函数日志

3. **数据库连接失败**
   - 确认 `DATABASE_URL` 正确
   - 确认使用连接池端点
   - 检查 SSL 配置

4. **Cron 任务不执行**
   - 确认 Cron 配置正确
   - 检查 Hobby 计划限制
   - 查看 Cron 执行日志

