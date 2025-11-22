# 修复代码错误指南

## 🚨 当前错误原因

您看到的 TypeScript 错误是因为：

1. **依赖包未安装** - `node_modules` 目录不存在或为空
2. **类型定义缺失** - TypeScript 无法找到类型声明文件

## ✅ 解决步骤

### 步骤 1: 安装依赖（最重要！）

```bash
pnpm install
```

这会安装所有必需的依赖包，包括：
- Next.js 及其类型定义
- React 及其类型定义
- Prisma 客户端
- 所有 UI 组件库
- 其他依赖

### 步骤 2: 生成 Prisma 客户端

```bash
pnpm db:generate
```

这会生成 Prisma 客户端的类型定义。

### 步骤 3: 重启 TypeScript 服务器

在 VS Code 中：
1. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
2. 输入 "TypeScript: Restart TS Server"
3. 回车执行

### 步骤 4: 验证修复

安装完成后，错误应该消失。如果仍有错误：

1. **检查 node_modules 是否存在**：
```bash
ls node_modules
```

2. **检查 TypeScript 配置**：
确保 `tsconfig.json` 存在且配置正确

3. **清理并重新安装**：
```bash
rm -rf node_modules .next
pnpm install
pnpm db:generate
```

## 📝 常见错误说明

### 错误类型 1: "找不到模块"
```
找不到模块"next/navigation"或其相应的类型声明。
```
**原因**：`node_modules` 中缺少该包  
**解决**：运行 `pnpm install`

### 错误类型 2: "JSX 元素隐式具有类型 any"
```
JSX 元素隐式具有类型 "any"，因为不存在接口 "JSX.IntrinsicElements"。
```
**原因**：React 类型定义未加载  
**解决**：安装依赖后重启 TS 服务器

### 错误类型 3: "BadgeProps 上不存在属性 variant"
```
不能将类型"{ variant: string; }"分配给类型"BadgeProps"。
```
**原因**：组件类型定义未加载  
**解决**：安装依赖后会自动解决

## ⚡ 快速修复命令

一键修复所有问题：

```bash
# 1. 安装依赖
pnpm install

# 2. 生成 Prisma 客户端
pnpm db:generate

# 3. 重启开发服务器（会自动重启 TS 服务器）
pnpm dev
```

## 🔍 验证安装

安装完成后，检查以下文件/目录是否存在：

- ✅ `node_modules/` 目录
- ✅ `node_modules/.prisma/` 目录
- ✅ `node_modules/next/` 目录
- ✅ `node_modules/react/` 目录
- ✅ `node_modules/@types/` 目录

如果这些都存在，错误应该就消失了！

## 💡 提示

- **首次安装可能需要几分钟**，请耐心等待
- **如果网络慢**，可以使用国内镜像：
  ```bash
  pnpm config set registry https://registry.npmmirror.com
  ```
- **安装完成后**，VS Code 可能需要几秒钟来加载类型定义

---

**总结：运行 `pnpm install` 就能解决大部分错误！** 🎉

