# 数据库初始化 SQL 脚本

本目录包含开发环境和正式环境的数据库初始化 SQL 脚本。

## 文件说明

- `init-dev.sql` - 开发环境初始化脚本（PostgreSQL 11）
- `init-prod.sql` - 正式环境初始化脚本（Neon PostgreSQL）

## 使用方法

### 开发环境（PostgreSQL 11）

1. **连接到数据库**
   ```bash
   psql -U postgres -d newsfocus_dev
   ```
   或者使用其他 PostgreSQL 客户端工具。

2. **执行初始化脚本**
   ```bash
   psql -U postgres -d newsfocus_dev -f sql/init-dev.sql
   ```
   或者在 psql 中：
   ```sql
   \i sql/init-dev.sql
   ```

3. **验证初始化**
   ```sql
   -- 检查表是否创建
   \dt
   
   -- 检查平台数据
   SELECT * FROM platforms;
   
   -- 检查关键词组数据
   SELECT * FROM keyword_groups;
   ```

### 正式环境（Neon）

1. **获取 Neon 数据库连接字符串**
   - 登录 [Neon Console](https://console.neon.tech/)
   - 选择项目，在 "Connection Details" 中复制连接字符串
   - Neon 提供两种连接方式：
     - **连接池连接**（`-pooler` 端点）：`postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`
     - **直接连接**（非连接池）：`postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

2. **执行初始化脚本**
   
   方式一：使用 psql 命令行（推荐使用直接连接）
   ```bash
   # 使用直接连接（非连接池）执行 SQL 脚本
   psql "postgresql://neondb_owner:password@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" -f sql/init-prod.sql
   ```
   
   方式二：使用 Neon Web Console
   - 登录 Neon Console
   - 进入项目的 SQL Editor
   - 复制 `init-prod.sql` 的内容
   - 粘贴并执行

   方式三：使用 Prisma Migrate（推荐）
   ```bash
   # 设置环境变量（使用直接连接用于迁移）
   export DATABASE_URL="postgresql://neondb_owner:password@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
   
   # 生成 Prisma 客户端
   npm run db:generate
   
   # 运行迁移
   npm run db:migrate:deploy
   
   # 填充种子数据
   npm run db:seed
   ```
   
   **注意：** 对于迁移操作，建议使用直接连接（非连接池），避免连接超时问题。

3. **验证初始化**
   ```sql
   -- 检查表是否创建
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   
   -- 检查平台数据
   SELECT * FROM platforms;
   
   -- 检查关键词组数据
   SELECT * FROM keyword_groups;
   ```

## 脚本内容说明

两个脚本都包含以下内容：

1. **表结构创建**
   - `platforms` - 平台表
   - `news_items` - 新闻项表
   - `keyword_groups` - 关键词组表
   - `news_matches` - 新闻匹配记录表
   - `news_appearances` - 新闻出现记录表
   - `push_records` - 推送记录表
   - `system_configs` - 系统配置表
   - `crawl_tasks` - 爬取任务记录表

2. **索引创建**
   - 为常用查询字段创建索引，优化查询性能

3. **触发器创建**
   - 自动更新 `updatedAt` 字段的触发器

4. **初始数据**
   - 11 个默认平台（知乎、微博、抖音等）
   - 2 个示例关键词组

## 注意事项

### 开发环境（PostgreSQL 11）

- 需要先创建数据库：
  ```sql
  CREATE DATABASE newsfocus_dev;
  ```
- 需要启用 `uuid-ossp` 扩展（脚本会自动创建）
- 使用 `uuid_generate_v4()` 生成 UUID

### 正式环境（Neon）

- Neon 自动管理扩展，无需手动创建
- 支持 `gen_random_uuid()` 函数（PostgreSQL 14+）
- 建议使用 SSL 连接（`sslmode=require`）
- 支持分支功能，可以创建测试分支

## 重新初始化

如果需要重新初始化数据库：

### 开发环境
```sql
-- 删除所有表（谨慎操作！）
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 重新执行初始化脚本
\i sql/init-dev.sql
```

### 正式环境
```bash
# 使用 Prisma 重置（推荐）
npx prisma migrate reset

# 或者手动删除表后重新执行脚本
```

## 故障排除

### 问题1: 扩展创建失败

**错误**: `ERROR: extension "uuid-ossp" does not exist`

**解决方案**:
```sql
-- PostgreSQL 11 需要安装扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 问题2: 权限不足

**错误**: `ERROR: permission denied`

**解决方案**:
- 确保使用具有足够权限的用户（通常是 `postgres` 超级用户）
- 或者授予用户必要的权限：
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE newsfocus_dev TO your_user;
  ```

### 问题3: 表已存在

**错误**: `ERROR: relation "platforms" already exists`

**解决方案**:
- 脚本使用 `CREATE TABLE IF NOT EXISTS`，不会报错
- 如果需要重新创建，先删除现有表：
  ```sql
  DROP TABLE IF EXISTS platforms CASCADE;
  ```

## 相关文档

- [Prisma Schema](../prisma/schema.prisma)
- [数据库设计文档](../04-数据模型设计.md)
- [部署架构文档](../07-部署架构.md)

