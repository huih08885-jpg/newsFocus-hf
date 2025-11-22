# Vercel 部署错误修复指南

## 🔴 错误原因

`ERR_INVALID_THIS` 和 `ERR_PNPM_META_FETCH_FAIL` 错误是由于：
- pnpm 版本与 Node.js 版本不兼容
- Vercel 构建环境中的 pnpm 版本问题

## ✅ 解决方案

### 方案 1：使用 Corepack（推荐，已应用）

已在 `vercel.json` 中配置：
```json
{
  "installCommand": "corepack enable && corepack prepare pnpm@latest --activate && pnpm install"
}
```

这会：
- 启用 Corepack（Node.js 内置的包管理器管理器）
- 自动准备并激活最新版本的 pnpm
- 然后运行安装

### 方案 2：改用 npm（最简单，最稳定）

如果方案 1 仍有问题，可以改用 npm：

**步骤 1：修改 `vercel.json`**
```json
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs",
  "installCommand": "npm install",
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

**步骤 2：生成 `package-lock.json`**
```bash
# 删除 pnpm-lock.yaml（如果存在）
rm pnpm-lock.yaml

# 生成 package-lock.json
npm install
```

**步骤 3：提交并推送**
```bash
git add package-lock.json vercel.json
git commit -m "fix: 改用 npm 以解决 Vercel 部署问题"
git push
```

### 方案 3：指定 Node.js 版本

已在项目中添加 `.nvmrc` 文件指定 Node.js 20。

如果 Vercel 没有自动识别，可以在 Vercel Dashboard 中设置：
1. 进入项目 Settings
2. General → Node.js Version
3. 选择 `20.x`

## 📋 当前配置

### 已应用的修复

1. ✅ **package.json**：添加了 `packageManager` 字段
2. ✅ **.nvmrc**：指定 Node.js 20
3. ✅ **vercel.json**：使用 Corepack 管理 pnpm

### 文件变更

- `package.json`：添加 `"packageManager": "pnpm@8.15.0"`
- `.nvmrc`：指定 Node.js 版本 `20`
- `vercel.json`：更新 installCommand 使用 Corepack

## 🚀 重新部署

1. **提交更改**：
```bash
git add package.json .nvmrc vercel.json
git commit -m "fix: 修复 Vercel 部署时的 pnpm 兼容性问题"
git push
```

2. **在 Vercel 中重新部署**：
   - 如果已连接 GitHub，推送后会自动触发部署
   - 或在 Vercel Dashboard 中点击 "Redeploy"

## 🔍 验证

部署成功后，检查：
1. ✅ Build 日志中没有 `ERR_INVALID_THIS` 错误
2. ✅ `pnpm install` 或 `npm install` 成功完成
3. ✅ `prisma generate` 成功执行
4. ✅ `next build` 成功完成

## 💡 如果仍有问题

### 检查 Vercel 构建日志

查看完整的错误信息，可能需要：
1. 检查 Node.js 版本是否匹配
2. 检查是否有其他依赖问题
3. 尝试清除 Vercel 构建缓存

### 临时解决方案

如果所有方案都不行，可以：
1. 使用 GitHub Actions 构建
2. 使用 Docker 构建
3. 联系 Vercel 支持

## 📚 相关文档

- [Vercel 构建配置](https://vercel.com/docs/build-step)
- [Corepack 文档](https://nodejs.org/api/corepack.html)
- [pnpm 部署指南](https://pnpm.io/continuous-integration)

