# 彩票预测表创建指南

## 概述

本指南说明如何创建彩票预测相关的数据库表。提供了**开发环境**和**生产环境**两个版本的SQL脚本。

---

## 文件列表

### 开发环境（Dev）

1. **`add_lottery_results_table_dev.sql`** - 创建开奖结果表
2. **`add_lottery_prediction_tables_dev.sql`** - 创建预测、分析、对比表

### 生产环境（Prod）

1. **`add_lottery_results_table_prod.sql`** - 创建开奖结果表
2. **`add_lottery_prediction_tables_prod.sql`** - 创建预测、分析、对比表

---

## 执行顺序

### ⚠️ 重要：必须先创建 `lottery_results` 表

因为 `lottery_comparisons` 表有外键引用 `lottery_results` 表，所以必须按以下顺序执行：

### 开发环境执行顺序

```sql
-- 步骤 1: 创建开奖结果表
\i sql/add_lottery_results_table_dev.sql

-- 步骤 2: 创建预测相关表（依赖步骤1）
\i sql/add_lottery_prediction_tables_dev.sql
```

### 生产环境执行顺序

```sql
-- 步骤 1: 创建开奖结果表
\i sql/add_lottery_results_table_prod.sql

-- 步骤 2: 创建预测相关表（依赖步骤1）
\i sql/add_lottery_prediction_tables_prod.sql
```

---

## 两个版本的主要区别

| 特性 | 开发环境 (Dev) | 生产环境 (Prod) |
|------|---------------|-----------------|
| **Schema** | 无 schema 前缀 | `public.` schema 前缀 |
| **时间类型** | `TIMESTAMP(6)` | `TIMESTAMPTZ` |
| **UUID 扩展** | 需要 `CREATE EXTENSION "pgcrypto"` | Neon 内置，无需扩展 |
| **函数命名** | `update_updated_at_column()` | `public.update_updated_at_column()` |
| **表命名** | `lottery_predictions` | `public.lottery_predictions` |

---

## 创建的表结构

### 1. lottery_results（开奖结果表）

**字段**:
- `id` - UUID 主键
- `period` - 期号（唯一）
- `date` - 开奖日期
- `red_balls` - 红球号码数组
- `blue_ball` - 蓝球号码
- `url` - 详情页URL
- `metadata` - 元数据（JSONB）
- `created_at` - 创建时间
- `updated_at` - 更新时间

**索引**:
- `idx_lottery_results_period` - 期号索引
- `idx_lottery_results_date` - 日期索引（降序）

---

### 2. lottery_predictions（预测结果表）

**字段**:
- `id` - UUID 主键
- `period` - 预测的期号
- `red_balls` - 预测的红球号码数组
- `blue_ball` - 预测的蓝球号码
- `confidence` - 预测置信度（0-1）
- `strategy` - 预测策略（保守型/平衡型/激进型）
- `reasoning` - 预测理由说明
- `sources` - 数据来源数组（statistical/ai/ml）
- `analysis_id` - 关联的分析ID（外键）
- `created_at` - 创建时间
- `updated_at` - 更新时间

**索引**:
- `idx_lottery_predictions_period` - 期号索引
- `idx_lottery_predictions_created_at` - 创建时间索引（降序）
- `idx_lottery_predictions_analysis_id` - 分析ID索引

**外键**:
- `fk_lottery_predictions_analysis` → `lottery_analysis(id)`

---

### 3. lottery_analysis（分析结果表）

**字段**:
- `id` - UUID 主键
- `type` - 分析类型（frequency/omission/distribution/pattern/comprehensive）
- `periods` - 使用的历史数据期数
- `config` - 分析配置参数（JSONB）
- `result` - 分析结果（JSONB）
- `summary` - 分析摘要
- `created_at` - 创建时间
- `updated_at` - 更新时间

**索引**:
- `idx_lottery_analysis_type` - 分析类型索引
- `idx_lottery_analysis_created_at` - 创建时间索引（降序）

---

### 4. lottery_comparisons（预测对比表）

**字段**:
- `id` - UUID 主键
- `prediction_id` - 关联的预测ID（外键）
- `result_id` - 关联的开奖结果ID（外键，可为空）
- `period` - 期号
- `red_balls_hit` - 红球命中数（0-6）
- `blue_ball_hit` - 蓝球是否命中
- `prize_level` - 中奖等级
- `prize_amount` - 奖金金额
- `accuracy` - 准确度（0-1）
- `created_at` - 创建时间
- `updated_at` - 更新时间

**索引**:
- `idx_lottery_comparisons_prediction_id` - 预测ID索引
- `idx_lottery_comparisons_result_id` - 结果ID索引
- `idx_lottery_comparisons_period` - 期号索引
- `idx_lottery_comparisons_prize_level` - 中奖等级索引
- `idx_lottery_comparisons_created_at` - 创建时间索引（降序）

**外键**:
- `fk_lottery_comparisons_prediction` → `lottery_predictions(id)`
- `fk_lottery_comparisons_result` → `lottery_results(id)`

---

## 自动功能

### 触发器

所有表都配置了自动更新 `updated_at` 字段的触发器：

- **函数**: `update_updated_at_column()` (dev) 或 `public.update_updated_at_column()` (prod)
- **触发时机**: 在 UPDATE 操作之前
- **作用**: 自动将 `updated_at` 设置为当前时间戳

---

## 验证步骤

执行完SQL脚本后，验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'  -- dev环境可能不需要schema
  AND table_name IN (
    'lottery_results',
    'lottery_predictions', 
    'lottery_analysis',
    'lottery_comparisons'
  );

-- 检查索引
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN (
  'lottery_results',
  'lottery_predictions',
  'lottery_analysis', 
  'lottery_comparisons'
);

-- 检查触发器
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN (
  'lottery_results',
  'lottery_predictions',
  'lottery_analysis',
  'lottery_comparisons'
);
```

---

## 常见问题

### Q: 执行时提示 "relation lottery_results does not exist"

**A**: 必须先执行 `add_lottery_results_table_*.sql`，再执行 `add_lottery_prediction_tables_*.sql`

### Q: 开发环境和生产环境可以混用吗？

**A**: 不可以。开发环境使用 `TIMESTAMP(6)` 和无 schema，生产环境使用 `TIMESTAMPTZ` 和 `public` schema。必须使用对应环境的脚本。

### Q: 脚本可以重复执行吗？

**A**: 可以。所有操作都包含 `IF NOT EXISTS` 检查，可以安全重复执行。

### Q: 触发器没有自动更新 updated_at？

**A**: 检查触发器是否创建成功：
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'lottery_predictions';
```

---

## 执行示例

### 开发环境（PostgreSQL）

```bash
# 连接到开发数据库
psql -h localhost -U your_user -d your_dev_db

# 执行脚本
\i sql/add_lottery_results_table_dev.sql
\i sql/add_lottery_prediction_tables_dev.sql
```

### 生产环境（Neon PostgreSQL）

```bash
# 连接到生产数据库
psql "postgresql://user:password@host/database"

# 执行脚本
\i sql/add_lottery_results_table_prod.sql
\i sql/add_lottery_prediction_tables_prod.sql
```

---

## 表关系图

```
lottery_analysis (分析结果)
    ↑
    | (1:N)
    |
lottery_predictions (预测结果)
    ↑
    | (1:N)
    |
lottery_comparisons (预测对比)
    ↓
    | (N:1)
    |
lottery_results (开奖结果)
```

---

**文档版本**: 1.0  
**最后更新**: 2024-12-XX  
**状态**: 完整

