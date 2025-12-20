# 环境变量配置文件设置

## 问题

Windows 的 cmd 不会自动加载 `.env` 文件，导致 Prisma 找不到 `DATABASE_URL` 环境变量。

## 解决方案

### 方法 1: 创建 .env.local 文件（推荐）

在项目根目录创建 `.env.local` 文件：

```bash
# .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
```

**注意**：将 `postgres`、`password`、`localhost:5432` 和 `newsfocus_dev` 替换为你的实际数据库配置。

### 方法 2: 使用系统环境变量

在 Windows 中设置系统环境变量：

1. 右键"此电脑" → "属性" → "高级系统设置"
2. 点击"环境变量"
3. 在"用户变量"或"系统变量"中添加：
   - 变量名：`DATABASE_URL`
   - 变量值：`postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public`

### 方法 3: 使用 PowerShell（自动加载 .env）

如果你使用 PowerShell，可以创建一个 PowerShell 脚本：

```powershell
# scripts/sync-db-schema.ps1
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
npx prisma db pull
npx prisma generate
```

## 检查环境变量

运行以下命令检查 `DATABASE_URL` 是否已设置：

```bash
# Windows cmd
echo %DATABASE_URL%

# PowerShell
echo $env:DATABASE_URL
```

## 数据库连接字符串格式

```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=public
```

示例：
- 本地开发：`postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public`
- Neon 生产：`postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

