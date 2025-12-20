# 故障排除指南

## ❌ 常见错误及解决方案

### 1. TypeScript 错误："找不到模块" 或 "JSX 元素隐式具有类型 any"

**错误示例：**
```
找不到模块"next/navigation"或其相应的类型声明。
JSX 元素隐式具有类型 "any"，因为不存在接口 "JSX.IntrinsicElements"。
```

**原因：**
- 依赖包尚未安装（`node_modules` 目录不存在）
- TypeScript 无法找到类型定义

**解决方案：**

1. **安装依赖**：
```bash
pnpm install
# 或
npm install
# 或
yarn install
```

2. **如果安装后仍有问题，重启 TypeScript 服务器**：
   - VS Code: `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
   - 输入 "TypeScript: Restart TS Server"
   - 回车执行

3. **确保安装了所有依赖**：
```bash
# 检查 node_modules 是否存在
ls node_modules

# 如果不存在，重新安装
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml
pnpm install
```

### 2. Prisma 客户端错误

**错误示例：**
```
找不到模块"@prisma/client"
```

**解决方案：**

1. **生成 Prisma 客户端**：
```bash
pnpm db:generate
```

2. **如果仍有问题，重新生成**：
```bash
rm -rf node_modules/.prisma
pnpm db:generate
```

### 3. 环境变量错误

**错误示例：**
```
DATABASE_URL environment variable is not set
```

**解决方案：**

1. **创建 `.env.local` 文件**（开发环境）：
```bash
cp .env.local.example .env.local
# 然后编辑 .env.local，填入数据库连接信息
```

2. **检查环境变量是否加载**：
```bash
# 在代码中打印
console.log(process.env.DATABASE_URL)
```

### 4. 数据库连接错误

**错误示例：**
```
Can't reach database server
```

**解决方案：**

1. **检查数据库服务是否运行**：
```bash
# PostgreSQL
pg_isready

# 或检查端口
lsof -i :5432
```

2. **检查连接字符串格式**：
```env
# 开发环境（PostgreSQL 11）
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"

# 生产环境（Neon）
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/newsfocus?sslmode=require"
```

3. **测试连接**：
```bash
psql $DATABASE_URL
```

### 5. 路径别名错误

**错误示例：**
```
Cannot find module '@/components/ui/card'
```

**解决方案：**

1. **检查 `tsconfig.json` 中的路径配置**：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

2. **重启 TypeScript 服务器**（见第1点）

3. **确保文件路径正确**：
   - 检查文件是否存在
   - 检查导入路径是否正确

### 6. 构建错误

**错误示例：**
```
Error: Cannot find module 'xxx'
```

**解决方案：**

1. **清理并重新安装**：
```bash
rm -rf .next node_modules
pnpm install
pnpm build
```

2. **检查 package.json 中的依赖**：
   - 确保所有必需的包都已列出
   - 检查版本是否兼容

### 7. 端口占用错误

**错误示例：**
```
Port 3000 is already in use
```

**解决方案：**

1. **使用其他端口**：
```bash
pnpm dev -- -p 3001
```

2. **或关闭占用端口的进程**：
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill
```

### 8. Prisma 报 `news_items.publishedAt` 不存在

**错误示例：**
```
Invalid prisma.newsItem.findMany() invocation:
The column news_items.publishedAt does not exist
```

**解决方案：**

1. **检查数据库实际列**
```bash
npm run check:db-columns
```

2. **按库类型执行 SQL**
```sql
-- 开发库 (Windows 本地)
ALTER TABLE news_items ADD COLUMN "publishedAt" TIMESTAMP NULL;

-- 生产库（Neon / Linux）
ALTER TABLE news_items ADD COLUMN "publishedat" TIMESTAMP NULL;
```

3. **确保 Prisma 字段映射正确**
```prisma
publishedAt DateTime? @map("publishedat")
```

4. **重新生成 Prisma Client**
```bash
npm run db:generate
```

### 9. 爬虫任务卡住或无法强制结束

**症状：**
- `crawl_tasks` 表中存在长时间 `pending`/`running` 状态
- 前端“强制结束任务”按钮无效果

**解决方案：**

1. **使用脚本批量清理**
```bash
# 清理超过 30 分钟未完成的任务
npm run cleanup:crawl-tasks

# 指定任务ID
npm run cleanup:crawl-tasks -- --task <taskId>

# 自定义超时时长（分钟）
npm run cleanup:crawl-tasks -- --minutes 15
```

2. **确认 API 正常**
- 前端按钮会请求 `/api/crawl/cleanup`
- 检查服务器日志确认返回 `success`

3. **持续卡住时检查**
- `lib/services/crawl-task-manager.ts` 中的阈值配置
- 平台接口是否频繁 403/429，可配合 `npm run diagnose:crawlers` 查看

## 🔧 完整重置步骤

如果以上方法都不行，尝试完全重置：

```bash
# 1. 删除所有生成的文件和依赖
rm -rf .next node_modules .env.local

# 2. 清理缓存
pnpm store prune

# 3. 重新安装依赖
pnpm install

# 4. 生成 Prisma 客户端
pnpm db:generate

# 5. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local

# 6. 初始化数据库
pnpm db:migrate
pnpm db:seed

# 7. 启动开发服务器
pnpm dev
```

## 📋 检查清单

在报告问题前，请确认：

- [ ] 已运行 `pnpm install`
- [ ] `node_modules` 目录存在
- [ ] 已创建 `.env.local` 文件
- [ ] 已运行 `pnpm db:generate`
- [ ] 数据库服务正在运行
- [ ] TypeScript 服务器已重启
- [ ] 所有文件路径正确

## 🆘 获取帮助

如果问题仍然存在：

1. **检查错误日志**：
   - 查看终端输出
   - 查看浏览器控制台
   - 查看 VS Code 问题面板

2. **提供信息**：
   - 错误消息
   - 操作系统
   - Node.js 版本 (`node -v`)
   - pnpm 版本 (`pnpm -v`)
   - 相关配置文件内容

3. **常见问题**：
   - 确保 Node.js 版本 >= 18
   - 确保使用 pnpm 8+ 或 npm/yarn 最新版本
   - 检查网络连接（安装依赖时）

