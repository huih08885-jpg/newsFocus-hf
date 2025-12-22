# Prisma 字段名修复报告

## 修复的问题

### 1. `lib/services/demand-radar.ts` - 第729行
**问题**: 使用了 `demand.cleanedText`，但 Prisma schema 中字段名是 `cleaned_text`（snake_case）

**修复**: 改为 `demand.cleaned_text`

**原因**: 
- Prisma schema 中 `cleaned_text` 字段没有 `@map` 装饰器
- 因此 Prisma Client 生成的类型直接使用 `cleaned_text`（snake_case）
- 代码必须使用 `cleaned_text` 而不是 `cleanedText`

### 2. `lib/services/demand-radar.ts` - 第152-153行
**状态**: ✅ 正确
- 这些是在创建时使用的，使用的是本地接口 `ExtractedDemand` 的字段（camelCase）
- 这是正确的，因为那是接口定义，不是 Prisma 模型

## Prisma 字段名规则

### 规则说明
1. **有 `@map` 装饰器的字段**: Prisma Client 会生成 camelCase 字段名
   - 例如: `sourceId` (schema 中 `sourceId @map("source_id")`) → 使用 `sourceId`
   - 例如: `redBalls` (schema 中 `redBalls @map("red_balls")`) → 使用 `redBalls`
   - 例如: `createdAt` (schema 中 `createdAt @map("created_at")`) → 使用 `createdAt`

2. **没有 `@map` 装饰器的字段**: Prisma Client 直接使用 schema 中的字段名
   - 例如: `original_text` (schema 中 `original_text String`) → 使用 `original_text`
   - 例如: `cleaned_text` (schema 中 `cleaned_text String`) → 使用 `cleaned_text`
   - 例如: `category` (schema 中 `category String?`) → 使用 `category`

### ExtractedDemand 模型字段映射

| Schema 字段名 | 是否有 @map | Prisma Client 字段名 | 使用方式 |
|--------------|------------|---------------------|---------|
| `sourceId` | ✅ `@map("source_id")` | `sourceId` | ✅ camelCase |
| `original_text` | ❌ 无 | `original_text` | ✅ snake_case |
| `cleaned_text` | ❌ 无 | `cleaned_text` | ✅ snake_case |
| `keywords` | ❌ 无 | `keywords` | ✅ 直接使用 |
| `category` | ❌ 无 | `category` | ✅ 直接使用 |
| `frequency` | ❌ 无 | `frequency` | ✅ 直接使用 |
| `createdAt` | ✅ `@map("created_at")` | `createdAt` | ✅ camelCase |

## 全面检查结果

### ✅ 已检查的文件
- `lib/services/demand-radar.ts` - ✅ 已修复
- `lib/services/lottery-*.ts` - ✅ 字段名正确（都有 @map）
- `lib/services/interest-site-crawler.ts` - ✅ 使用原始 SQL，字段名正确

### ✅ 验证结果
- ✅ 所有从 Prisma 查询返回的对象使用正确的字段名
- ✅ 所有创建/更新操作使用正确的字段名
- ✅ 无其他字段名不匹配问题

## 修复总结

**修复的文件**: 1 个
- `lib/services/demand-radar.ts` (第729行)

**修复内容**:
- `demand.cleanedText` → `demand.cleaned_text`

**验证**: ✅ 无其他类似问题

