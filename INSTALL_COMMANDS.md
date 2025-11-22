# 📦 安装依赖命令清单

请按顺序执行以下命令：

## 步骤 1: 安装所有依赖包

```bash
npm install
```

**说明：** 这会安装 `package.json` 中列出的所有依赖包，包括：
- Next.js、React、TypeScript
- Prisma、数据库相关包
- UI 组件库（shadcn/ui、Radix UI）
- 图表库（Recharts）
- 其他工具库

**预计时间：** 2-5 分钟（取决于网络速度）

---

## 步骤 2: 生成 Prisma 客户端

```bash
npm run db:generate
```

**说明：** 这会根据 Prisma Schema 生成数据库客户端和类型定义

**预计时间：** 10-30 秒

---

## 步骤 3: 配置环境变量（如果还没有）

```bash
# Windows (PowerShell)
Copy-Item .env.local.example .env.local

# Windows (CMD)
copy .env.local.example .env.local

# macOS/Linux
cp .env.local.example .env.local
```

然后编辑 `.env.local` 文件，填入数据库连接信息：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"
```

---

## 步骤 4: 初始化数据库（可选，如果数据库已存在可跳过）

```bash
# 运行数据库迁移
npm run db:migrate

# 填充种子数据
npm run db:seed
```

**说明：** 
- `db:migrate` 会创建数据库表结构
- `db:seed` 会填充初始数据（平台列表等）

**预计时间：** 10-30 秒

---

## 步骤 5: 重启 TypeScript 服务器（在 VS Code 中）

1. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
2. 输入 `TypeScript: Restart TS Server`
3. 回车执行

**说明：** 这会重新加载所有类型定义，消除错误标志

---

## ✅ 验证安装

执行以下命令验证安装是否成功：

```bash
# 检查 node_modules 是否存在
ls node_modules

# 检查 Prisma 客户端是否生成
ls node_modules/.prisma

# 检查 Next.js 是否安装
ls node_modules/next
```

如果这些目录都存在，说明安装成功！

---

## 🚀 启动开发服务器

安装完成后，可以启动开发服务器：

```bash
npm run dev
```

然后访问 http://localhost:3000

---

## 📝 完整命令序列（复制粘贴）

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma 客户端
npm run db:generate

# 3. 创建环境变量文件（如果还没有）
# Windows PowerShell:
Copy-Item .env.local.example .env.local
# Windows CMD:
# copy .env.local.example .env.local
# macOS/Linux:
# cp .env.local.example .env.local

# 4. 初始化数据库（可选）
npm run db:migrate
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

---

## ⚠️ 常见问题

### 问题 1: 网络慢或超时

**解决方案：** 使用国内镜像
```bash
# 设置 npm 镜像
npm config set registry https://registry.npmmirror.com

# 然后重新安装
npm install
```

### 问题 2: 权限错误（macOS/Linux）

**解决方案：**
```bash
sudo npm install
```

### 问题 3: 如果想使用 pnpm（可选）

**解决方案：**
```bash
# 安装 pnpm
npm install -g pnpm

# 然后使用 pnpm
pnpm install
```

---

## 📚 更多帮助

- [快速开始指南](./QUICK_START.md)
- [故障排除指南](./TROUBLESHOOTING.md)
- [修复错误指南](./FIX_ERRORS.md)

