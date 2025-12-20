# 数据库迁移指南

## 📋 概述

本指南说明如何在已有数据库上安全地执行SQL脚本，添加新功能（如情感分析字段）。

## 🔍 脚本特点

### 安全性
- ✅ 使用 `CREATE TABLE IF NOT EXISTS` - 表不存在时才创建
- ✅ 使用 `DO $$ ... END $$` 块检查字段是否存在 - 字段不存在时才添加
- ✅ 使用 `CREATE INDEX IF NOT EXISTS` - 索引不存在时才创建
- ✅ 使用 `CREATE OR REPLACE FUNCTION` - 函数总是更新到最新版本
- ✅ 使用 `DO $$ ... END $$` 块检查触发器是否存在 - 触发器不存在时才创建
- ✅ 使用 `ON CONFLICT DO NOTHING` - 插入数据时避免重复

### 增量更新
- ✅ 支持在已有数据库上执行
- ✅ 不会删除或修改现有数据
- ✅ 只添加缺失的字段、索引和触发器

## 📝 使用方法

### 开发环境（PostgreSQL 11）

```bash
# 方法1: 使用 psql 命令行
psql -U postgres -d newsfocus_dev -f sql/init-dev.sql

# 方法2: 使用环境变量
psql $DATABASE_URL -f sql/init-dev.sql

# 方法3: 在 psql 中执行
psql -U postgres -d newsfocus_dev
\i sql/init-dev.sql
```

### 生产环境（Neon PostgreSQL）

```bash
# 方法1: 使用 psql 命令行（需要 DATABASE_URL_UNPOOLED）
psql $DATABASE_URL_UNPOOLED -f sql/init-prod.sql

# 方法2: 在 Neon Console 的 SQL Editor 中执行
# 复制 sql/init-prod.sql 的内容，粘贴到 SQL Editor 中执行
```

## 🔄 迁移流程

### 第一次执行（全新数据库）
1. 创建所有表
2. 添加所有字段（包括 sentiment 和 sentimentScore）
3. 创建所有索引
4. 创建所有触发器
5. 插入初始数据

### 后续执行（已有数据库）
1. 跳过已存在的表
2. **只添加缺失的字段**（如 sentiment 和 sentimentScore）
3. 跳过已存在的索引
4. 跳过已存在的触发器
5. 跳过已存在的数据（使用 ON CONFLICT DO NOTHING）

## ⚠️ 注意事项

### 1. 字段添加
- 使用 `DO $$ ... END $$` 块检查字段是否存在
- 如果字段已存在，会输出 NOTICE 但不会报错
- 新字段为可选（NULL），不会影响现有数据

### 2. 索引创建
- 使用 `CREATE INDEX IF NOT EXISTS`
- 如果索引已存在，会跳过创建
- 不会影响现有查询性能

### 3. 触发器创建
- 使用 `DO $$ ... END $$` 块检查触发器是否存在
- 如果触发器已存在，会跳过创建
- 不会影响现有数据更新逻辑

### 4. 数据插入
- 使用 `ON CONFLICT DO NOTHING`
- 如果数据已存在，会跳过插入
- 不会修改现有数据

## 🧪 测试建议

### 1. 备份数据库（重要！）
```bash
# 开发环境
pg_dump -U postgres newsfocus_dev > backup_dev_$(date +%Y%m%d).sql

# 生产环境（Neon）
pg_dump $DATABASE_URL_UNPOOLED > backup_prod_$(date +%Y%m%d).sql
```

### 2. 在测试环境先执行
- 先在开发环境测试
- 确认无误后再在生产环境执行

### 3. 验证结果
```sql
-- 检查字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'news_items' 
  AND column_name IN ('sentiment', 'sentimentScore');

-- 检查索引是否存在
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'news_items' 
  AND indexname LIKE '%sentiment%';

-- 检查数据完整性
SELECT COUNT(*) FROM news_items;
SELECT COUNT(*) FROM news_items WHERE sentiment IS NOT NULL;
```

## 📊 执行日志示例

### 成功执行（字段已存在）
```
NOTICE:  字段 news_items.sentiment 已存在，跳过
NOTICE:  字段 news_items.sentimentScore 已存在，跳过
NOTICE:  开发环境数据库初始化完成！
```

### 成功执行（字段不存在）
```
NOTICE:  已添加字段: news_items.sentiment
NOTICE:  已添加字段: news_items.sentimentScore
NOTICE:  开发环境数据库初始化完成！
```

## 🔧 故障排除

### 问题1: 字段添加失败
**错误**: `column "sentiment" already exists`
**解决**: 这是正常的，脚本会检查字段是否存在，如果已存在会跳过

### 问题2: 外键约束错误
**错误**: `foreign key constraint fails`
**解决**: 确保 `platforms` 表已存在且包含所需数据

### 问题3: 权限不足
**错误**: `permission denied`
**解决**: 确保数据库用户有 CREATE TABLE、ALTER TABLE 等权限

## ✅ 验证清单

执行脚本后，请验证：

- [ ] 所有表都存在
- [ ] `news_items` 表有 `sentiment` 字段
- [ ] `news_items` 表有 `sentimentScore` 字段
- [ ] 相关索引已创建
- [ ] 触发器正常工作
- [ ] 现有数据未被修改
- [ ] 可以正常插入新数据

## 📚 相关文档

- [Prisma 迁移指南](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Neon 数据库文档](https://neon.tech/docs)

