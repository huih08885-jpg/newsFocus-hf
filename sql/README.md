# SQL 初始化脚本说明

## 📋 文件说明

### `init-dev.sql` - 开发环境脚本
- **数据库**: PostgreSQL 11+
- **用途**: 本地开发环境数据库初始化
- **UUID 生成**: 使用 `uuid_generate_v4()`（需要 uuid-ossp 扩展）

### `init-prod.sql` - 正式环境脚本
- **数据库**: Neon PostgreSQL (兼容 PostgreSQL 14+)
- **用途**: 生产环境数据库初始化
- **UUID 生成**: 使用 `gen_random_uuid()`（Neon 内置支持）

## 🚀 使用方法

### 开发环境（PostgreSQL 11）

```bash
# 连接到数据库
psql -U postgres -d newsfocus_dev

# 执行脚本
\i sql/init-dev.sql

# 或使用命令行
psql -U postgres -d newsfocus_dev -f sql/init-dev.sql
```

### 正式环境（Neon）

1. 登录 Neon 控制台
2. 打开 SQL Editor
3. 复制 `init-prod.sql` 内容
4. 执行脚本

或使用命令行：

```bash
# 使用 Neon 连接字符串
psql "postgresql://user:password@host/database?sslmode=require" -f sql/init-prod.sql
```

## 📊 表结构说明

### 核心业务表
- `platforms` - 平台表
- `news_items` - 新闻项表
- `keyword_groups` - 关键词组表
- `news_matches` - 新闻匹配记录表
- `news_appearances` - 新闻出现记录表

### 系统表
- `push_records` - 推送记录表
- `system_configs` - 系统配置表
- `crawl_tasks` - 爬取任务记录表

### 用户认证表
- `users` - 用户表
- `sessions` - 会话表

## 🔍 索引说明

所有表都创建了必要的索引以优化查询性能：
- 主键索引（自动创建）
- 唯一索引
- 外键索引
- 复合索引（用于多字段查询）
- 时间索引（用于时间范围查询）

## ⚙️ 触发器说明

所有包含 `updatedAt` 字段的表都创建了触发器，自动更新该字段：
- `platforms`
- `news_items`
- `keyword_groups`
- `news_matches`
- `system_configs`
- `crawl_tasks`
- `users`

## 📝 初始数据

脚本会自动插入：
- 11 个平台的初始数据（知乎、微博、抖音等）
- 2 个示例关键词组（AI 人工智能、华为 手机）

## ⚠️ 注意事项

1. **开发环境**：
   - 需要先创建数据库：`CREATE DATABASE newsfocus_dev;`
   - 需要安装 uuid-ossp 扩展

2. **正式环境（Neon）**：
   - Neon 自动管理扩展，无需手动安装
   - 使用 `gen_random_uuid()` 而不是 `uuid_generate_v4()`

3. **执行顺序**：
   - 脚本使用 `IF NOT EXISTS`，可以安全地重复执行
   - 初始数据使用 `ON CONFLICT DO NOTHING`，不会重复插入

4. **权限要求**：
   - 需要 CREATE TABLE、CREATE INDEX、CREATE TRIGGER 权限
   - 需要 INSERT 权限

## 🔄 更新数据库

如果表已存在，可以使用 Prisma Migrate：

```bash
# 生成迁移文件
pnpm db:migrate

# 应用迁移
pnpm db:migrate:deploy
```

## 📚 相关文档

- `prisma/schema.prisma` - Prisma 数据模型定义
- `AUTH_SETUP.md` - 用户认证系统设置指南
