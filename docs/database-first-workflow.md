# Database First 工作流指南

## 概述

Database First 工作流意味着：**数据库是唯一事实来源**。你直接修改数据库，然后让 Prisma 自动同步 schema。

## 工作流程

### 1. 修改数据库（直接执行 SQL）

```bash
# 开发环境
psql $DATABASE_URL -f sql/add_unified_search_tables_dev.sql

# 或生产环境
psql $DATABASE_URL -f sql/add_unified_search_tables_prod.sql
```

### 2. 同步 Prisma Schema（自动拉取数据库结构）

```bash
npx prisma db pull
```

这个命令会：
- 扫描数据库中的所有表
- 自动更新 `prisma/schema.prisma` 文件
- 匹配字段类型和约束

### 3. 生成 Prisma 客户端

```bash
npx prisma generate
```

这个命令会：
- 根据更新后的 schema 生成 TypeScript 类型
- 更新 Prisma 客户端代码

### 4. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

## 完整流程示例

假设你要添加一个新表 `site_candidates`：

```bash
# 1. 执行 SQL 脚本创建表
psql $DATABASE_URL -f sql/add_unified_search_tables_dev.sql

# 2. 从数据库拉取结构并更新 schema
npx prisma db pull

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 重启开发服务器（如果需要）
# Ctrl+C 停止，然后 npm run dev
```

## 注意事项

1. **停止开发服务器**：在执行 `prisma generate` 之前，最好先停止开发服务器，避免文件锁定问题

2. **检查 schema 变化**：`db pull` 会覆盖 `schema.prisma`，如果有手动添加的注释或配置，可能需要重新添加

3. **字段映射**：如果数据库使用 snake_case，Prisma 会自动添加 `@map` 注解

4. **类型匹配**：Prisma 会尝试匹配数据库类型到 Prisma 类型，如果有不匹配的地方，可能需要手动调整

## 优势

✅ **简单**：直接改数据库，不需要手动维护 schema  
✅ **类型安全**：自动生成 TypeScript 类型  
✅ **同步**：schema 始终与数据库一致  
✅ **无代码改动**：不需要修改业务代码  

## 与 Schema First 的区别

| 方式 | Schema First | Database First |
|------|-------------|----------------|
| 起点 | `schema.prisma` | 数据库 |
| 修改方式 | 修改 schema → 生成迁移 → 应用迁移 | 执行 SQL → 拉取 schema |
| 适用场景 | 新项目、团队协作 | 已有数据库、快速迭代 |

## 常用命令

```bash
# 从数据库拉取结构
npx prisma db pull

# 生成客户端
npx prisma generate

# 查看数据库（可选）
npx prisma studio

# 查看 schema 与数据库的差异（如果有）
npx prisma db pull --print
```

## 故障排除

### 问题：`db pull` 后字段类型不匹配

**解决**：手动调整 `schema.prisma` 中的类型，然后运行 `prisma generate`

### 问题：`prisma generate` 报文件锁定错误

**解决**：停止开发服务器，然后重试

### 问题：生成的类型与预期不符

**解决**：检查数据库字段类型，必要时在 schema 中添加 `@map` 或类型注解

