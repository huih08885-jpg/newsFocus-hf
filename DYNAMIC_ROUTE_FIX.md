# Next.js 动态路由修复总结

## 🔍 问题分析

### 错误信息
```
Dynamic server usage: Page couldn't be rendered statically because it used 'nextUrl.searchParams'
Dynamic server usage: Page couldn't be rendered statically because it used 'cookies'
```

### 根本原因

Next.js 14 在构建时会尝试静态生成所有路由（包括 API 路由）。但是：

1. **使用 `searchParams` 的路由**：
   - `request.nextUrl.searchParams` 是动态的，取决于请求时的查询参数
   - 无法在构建时静态生成

2. **使用 `cookies()` 的路由**：
   - `cookies()` 读取的是请求时的 Cookie
   - 无法在构建时静态生成

### 解决方案

在相关 API 路由文件中添加：
```typescript
export const dynamic = 'force-dynamic'
```

这会告诉 Next.js 这些路由应该动态渲染，而不是静态生成。

## ✅ 已修复的文件

### 使用 searchParams 的路由（7个）
1. ✅ `app/api/analytics/route.ts`
2. ✅ `app/api/analytics/trends/route.ts`
3. ✅ `app/api/news/route.ts`
4. ✅ `app/api/news/platforms/route.ts`
5. ✅ `app/api/news/platforms/public/route.ts`
6. ✅ `app/api/notify/history/route.ts`
7. ✅ `app/api/config/route.ts`

### 使用 cookies 的路由（4个）
1. ✅ `app/api/auth/me/route.ts`
2. ✅ `app/api/auth/login/route.ts`
3. ✅ `app/api/auth/logout/route.ts`
4. ✅ `app/api/auth/register/route.ts`

## 📋 修复模式

### 修复前
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  // ...
}
```

### 修复后
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// 强制动态渲染（因为使用了 searchParams）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  // ...
}
```

## 🎯 Next.js 路由渲染模式

### 静态渲染（Static）
- 在构建时生成
- 适合内容不变的路由
- 性能最好

### 动态渲染（Dynamic）
- 在请求时生成
- 适合内容变化的路由
- 使用 `export const dynamic = 'force-dynamic'` 强制动态

### 何时使用 force-dynamic

以下情况需要添加 `export const dynamic = 'force-dynamic'`：

1. ✅ 使用 `request.nextUrl.searchParams`
2. ✅ 使用 `cookies()` 或 `headers()`
3. ✅ 使用动态路由参数（如 `[id]`）且需要动态数据
4. ✅ 需要访问请求时的环境变量
5. ✅ 需要访问用户特定的数据

## 📊 影响分析

### 性能影响
- **静态路由**：构建时生成，响应最快
- **动态路由**：请求时生成，响应稍慢但仍然是服务器端渲染

### 适用场景
- **API 路由**：通常都是动态的，因为需要处理请求数据
- **页面路由**：根据内容是否变化决定静态或动态

## ✅ 验证

修复后，构建应该：
- ✅ 不再出现 `DYNAMIC_SERVER_USAGE` 错误
- ✅ 所有 API 路由正确标记为动态
- ✅ 构建成功完成

## 💡 最佳实践

1. **API 路由**：
   - 默认使用 `force-dynamic`
   - 除非确定可以静态生成

2. **页面路由**：
   - 优先使用静态生成
   - 只在必要时使用动态渲染

3. **类型安全**：
   - TypeScript 会在编译时检查
   - 确保类型正确

## 🔄 后续检查

如果添加新的 API 路由，记得：
1. 检查是否使用 `searchParams` 或 `cookies`
2. 如果使用，添加 `export const dynamic = 'force-dynamic'`
3. 测试构建是否成功

