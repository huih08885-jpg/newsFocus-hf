# 📦 使用 npm 安装依赖（Windows）

## ✅ 快速安装命令

请按顺序执行以下命令：

### 1. 安装所有依赖包

```bash
npm install
```

**预计时间：** 2-5 分钟

---

### 2. 生成 Prisma 客户端

```bash
npm run db:generate
```

**预计时间：** 10-30 秒

---

### 3. 创建环境变量文件

**Windows PowerShell:**
```powershell
Copy-Item .env.local.example .env.local
```

**Windows CMD:**
```cmd
copy .env.local.example .env.local
```

然后编辑 `.env.local` 文件，填入数据库连接信息：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public"
NODE_ENV="development"
```

---

### 4. 初始化数据库（可选）

```bash
npm run db:migrate
npm run db:seed
```

---

### 5. 启动开发服务器

```bash
npm run dev
```

然后访问 http://localhost:3000

---

## 📋 完整命令序列（一键复制）

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma 客户端
npm run db:generate

# 3. 创建环境变量文件（PowerShell）
Copy-Item .env.local.example .env.local

# 4. 初始化数据库（可选）
npm run db:migrate
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

---

## 🔍 验证安装

安装完成后，检查 `node_modules` 目录是否存在：

```bash
dir node_modules
```

如果看到很多文件夹，说明安装成功！

---

## ⚠️ 常见问题

### 问题 1: 网络慢或超时

**解决方案：** 使用国内镜像
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 问题 2: 安装失败

**解决方案：** 清理缓存后重试
```bash
npm cache clean --force
npm install
```

### 问题 3: 权限错误

**解决方案：** 以管理员身份运行命令提示符或 PowerShell

---

## 📝 常用 npm 命令

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run db:generate      # 生成 Prisma 客户端
npm run db:migrate       # 运行数据库迁移
npm run db:seed          # 填充种子数据
npm run db:studio        # 打开 Prisma Studio
```

---

## ✅ 安装完成后

1. ✅ 重启 VS Code
2. ✅ 重启 TypeScript 服务器（Ctrl+Shift+P -> "TypeScript: Restart TS Server"）
3. ✅ 错误标志应该消失

---

**提示：** 如果安装过程中遇到任何问题，请查看终端输出的错误信息。

