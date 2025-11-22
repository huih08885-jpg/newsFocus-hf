# Vercel 部署修复 - 改用 npm

## 🔴 问题

pnpm 在 Vercel 构建环境中出现 `ERR_INVALID_THIS` 错误，这是 pnpm 与 Node.js 版本兼容性问题。

## ✅ 解决方案：改用 npm

npm 在 Vercel 上更稳定可靠，已更新配置使用 npm。

## 📋 已完成的更改

1. ✅ **vercel.json**：改用 `npm ci`（更快、更可靠）
2. ✅ **package.json**：移除了 `packageManager` 字段
3. ✅ **.npmrc**：添加了 npm 配置

## 🚀 下一步操作

### 步骤 1：生成 package-lock.json

在本地运行（如果还没有）：

```bash
# 如果本地使用 pnpm，先安装依赖
pnpm install

# 然后生成 package-lock.json
npm install --package-lock-only

# 或者直接运行（会生成 package-lock.json）
npm install
```

**注意**：如果本地没有 npm，可以：
- 安装 Node.js（自带 npm）
- 或者直接提交代码，Vercel 会自动生成

### 步骤 2：提交更改

```bash
git add vercel.json package.json .npmrc
git commit -m "fix: 改用 npm 以解决 Vercel 部署问题"
git push
```

### 步骤 3：在 Vercel 中重新部署

推送后会自动触发部署，或手动点击 "Redeploy"。

## 📝 配置说明

### vercel.json

```json
{
  "installCommand": "npm ci"
}
```

`npm ci` 的优势：
- ✅ 更快（跳过依赖解析）
- ✅ 更可靠（使用 package-lock.json）
- ✅ 适合 CI/CD 环境

### .npmrc

```
legacy-peer-deps=false
auto-install-peers=true
```

确保依赖安装的一致性。

## 🔍 验证

部署成功后检查：
1. ✅ Build 日志中没有 `ERR_INVALID_THIS` 错误
2. ✅ `npm ci` 成功完成
3. ✅ `prisma generate` 成功执行
4. ✅ `next build` 成功完成

## 💡 本地开发

本地开发仍然可以使用 pnpm：

```bash
# 本地开发
pnpm install
pnpm dev

# 部署前生成 package-lock.json（如果需要）
npm install --package-lock-only
```

## 📚 相关文档

- [npm ci 文档](https://docs.npmjs.com/cli/v9/commands/npm-ci)
- [Vercel 构建配置](https://vercel.com/docs/build-step)

