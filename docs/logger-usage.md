# 日志系统使用指南

## 📋 概述

系统已集成统一的日志系统，支持：
- ✅ 控制台输出（开发调试）
- ✅ 文件记录（持久化存储）
- ✅ 日志轮转（自动管理文件大小）
- ✅ 日志清理（定期清理旧日志）
- ✅ 错误追踪（包含堆栈信息）

## 📁 日志文件位置

日志文件存储在项目根目录的 `logs/` 文件夹中：

```
logs/
├── app.log          # 所有日志（info, warn, error等）
├── app.log.1        # 轮转后的历史日志
├── app.log.2
├── error.log        # 仅错误日志
└── error.log.1      # 轮转后的历史错误日志
```

**注意**：`logs/` 目录已添加到 `.gitignore`，不会被提交到版本控制。

## 🚀 快速使用

### 基本用法

```typescript
import { logger } from '@/lib/utils/logger'

// Info 日志
logger.info('用户登录成功', 'AuthService', { userId: '123' })

// Warning 日志
logger.warn('API 响应较慢', 'APIService', { endpoint: '/api/news', duration: 5000 })

// Error 日志
try {
  // 一些操作
} catch (error) {
  logger.error('操作失败', error instanceof Error ? error : new Error(String(error)), 'ServiceName', { context: 'additional info' })
}

// Debug 日志（仅在开发环境输出）
logger.debug('调试信息', 'ServiceName', { data: 'value' })
```

### 在 API 路由中使用

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/utils/error-handler'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    logger.info('收到请求', 'APIEndpoint', { method: 'GET' })
    
    // 业务逻辑
    const result = await someOperation()
    
    logger.info('请求处理成功', 'APIEndpoint', { resultCount: result.length })
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    // 使用 handleError 自动记录错误并返回响应
    return handleError(error, 'APIEndpoint', '操作失败')
  }
}
```

### 在服务类中使用

```typescript
import { logger } from '@/lib/utils/logger'

export class MyService {
  async doSomething() {
    try {
      logger.info('开始执行操作', 'MyService')
      
      // 执行操作
      const result = await this.performOperation()
      
      logger.info('操作完成', 'MyService', { result })
      return result
    } catch (error) {
      logger.error('操作失败', error instanceof Error ? error : new Error(String(error)), 'MyService')
      throw error
    }
  }
}
```

## 📝 日志级别

### Debug
- **用途**：详细的调试信息
- **输出**：仅在开发环境输出到控制台
- **文件**：记录到 `app.log`

```typescript
logger.debug('变量值', 'ServiceName', { variable: value })
```

### Info
- **用途**：一般信息，如操作开始、完成等
- **输出**：控制台和文件
- **文件**：记录到 `app.log`

```typescript
logger.info('任务开始执行', 'TaskService', { taskId: '123' })
```

### Warn
- **用途**：警告信息，如性能问题、降级操作等
- **输出**：控制台和文件
- **文件**：记录到 `app.log`

```typescript
logger.warn('API 响应较慢', 'APIService', { endpoint: '/api/data', duration: 3000 })
```

### Error
- **用途**：错误信息，包含异常对象
- **输出**：控制台和文件
- **文件**：同时记录到 `app.log` 和 `error.log`

```typescript
try {
  // 操作
} catch (error) {
  logger.error('操作失败', error instanceof Error ? error : new Error(String(error)), 'ServiceName', { context: 'additional info' })
}
```

## 🔧 配置选项

### 日志文件大小限制

默认每个日志文件最大 10MB，可在 `lib/utils/logger.ts` 中修改：

```typescript
private maxFileSize: number = 10 * 1024 * 1024 // 10MB
```

### 保留文件数量

默认保留 5 个历史文件，可在 `lib/utils/logger.ts` 中修改：

```typescript
private maxFiles: number = 5 // 保留5个历史文件
```

### 日志目录

默认日志目录为 `logs/`，可在 `lib/utils/logger.ts` 中修改：

```typescript
this.logDir = path.join(process.cwd(), 'logs')
```

## 🧹 日志清理

系统已配置定时任务，每天 UTC 03:00（北京时间 11:00）自动清理 30 天前的旧日志。

### 手动清理

```typescript
import { logger } from '@/lib/utils/logger'

// 清理30天前的日志
logger.cleanup(30 * 24 * 60 * 60 * 1000)

// 清理7天前的日志
logger.cleanup(7 * 24 * 60 * 60 * 1000)
```

### API 接口

```bash
GET /api/cron/cleanup-logs
Authorization: Bearer ${CRON_SECRET}
```

## 📊 日志格式

### 控制台输出格式

```
2024-12-XXT10:30:45.123Z INFO  [ServiceName] 日志消息 { metadata }
```

### 文件记录格式

```
2024-12-XXT10:30:45.123Z [INFO] [ServiceName] 日志消息 {"metadata":"value"}
错误: Error message
堆栈:
Error: Error message
    at ...
```

## 🎯 最佳实践

### 1. 使用有意义的上下文名称

```typescript
// ✅ 好
logger.info('用户登录', 'AuthService', { userId: '123' })

// ❌ 不好
logger.info('操作', 'Service', {})
```

### 2. 包含必要的元数据

```typescript
// ✅ 好
logger.info('爬取完成', 'CrawlerService', {
  platform: 'baidu',
  count: 100,
  duration: 5000,
})

// ❌ 不好
logger.info('爬取完成', 'CrawlerService')
```

### 3. 错误日志包含完整信息

```typescript
// ✅ 好
try {
  await operation()
} catch (error) {
  logger.error(
    '操作失败',
    error instanceof Error ? error : new Error(String(error)),
    'ServiceName',
    {
      operationId: '123',
      input: sanitizedInput, // 注意：不要记录敏感信息
    }
  )
}

// ❌ 不好
try {
  await operation()
} catch (error) {
  logger.error('失败', new Error('Unknown'), 'ServiceName')
}
```

### 4. 不要记录敏感信息

```typescript
// ❌ 不要这样做
logger.info('用户登录', 'AuthService', {
  password: user.password, // 敏感信息
  token: user.token,       // 敏感信息
})

// ✅ 应该这样做
logger.info('用户登录', 'AuthService', {
  userId: user.id,
  email: user.email, // 如果允许的话
})
```

## 🔍 查看日志

### 开发环境

```bash
# 查看所有日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看最近的100行
tail -n 100 logs/app.log

# 搜索特定内容
grep "DemandRadar" logs/app.log
```

### 生产环境

在生产环境（如 Vercel），日志会输出到 Vercel Logs，可以通过 Vercel Dashboard 查看。

## 📈 日志轮转机制

当日志文件达到最大大小（10MB）时，系统会自动轮转：

1. `app.log` → `app.log.1`
2. `app.log.1` → `app.log.2`
3. `app.log.2` → `app.log.3`
4. ...以此类推
5. 最旧的文件会被删除（如果超过 `maxFiles` 个）

## ⚠️ 注意事项

1. **文件系统权限**：确保应用有权限在项目根目录创建 `logs/` 文件夹
2. **磁盘空间**：定期检查日志文件大小，避免占用过多磁盘空间
3. **性能影响**：文件写入是同步操作，大量日志可能影响性能（可考虑异步写入）
4. **生产环境**：在生产环境，建议使用专业的日志服务（如 Vercel Logs、Sentry 等）

## 🔄 迁移现有代码

### 替换 console.log

```typescript
// 旧代码
console.log('[Service] 消息')

// 新代码
logger.info('消息', 'Service')
```

### 替换 console.error

```typescript
// 旧代码
console.error('[Service] 错误:', error)

// 新代码
logger.error('错误', error instanceof Error ? error : new Error(String(error)), 'Service')
```

### 替换 console.warn

```typescript
// 旧代码
console.warn('[Service] 警告')

// 新代码
logger.warn('警告', 'Service')
```

## 📚 相关文件

- `lib/utils/logger.ts` - 日志系统核心实现
- `lib/utils/error-handler.ts` - 错误处理工具
- `app/api/cron/cleanup-logs/route.ts` - 日志清理定时任务
- `logs/` - 日志文件目录（自动创建）

---

**最后更新**: 2024-12-XX

