# 需求雷达模块使用指南

## 📋 概述

需求雷达模块是一个自动化工具，用于每天捕捉欧美市场的需求缺口。它从多个平台抓取数据，提取用户需求，并生成每日需求榜单。

## 🎯 功能特性

1. **多平台数据抓取**
   - Reddit（帖子标题 + 评论）
   - Product Hunt（当日产品 + Upvotes）
   - Hacker News（评论区抱怨/需求）
   - G2（差评）- 待实现
   - Toolify（搜索热度）- 待实现
   - Twitter/X（关键词）- 待实现

2. **智能需求提取**
   - 自动识别需求模式（"I need a tool that...", "Does anyone know a tool for..."等）
   - 关键词提取和分类
   - 文本清洗和去重

3. **需求聚类和排序**
   - 按频次排序
   - 趋势分析（上升/下降/新增/稳定）
   - 生成每日 Top 20 榜单

## 🚀 快速开始

### 1. 数据库迁移

首先需要运行数据库迁移，创建需求雷达相关的表：

```bash
# 生成 Prisma Client
npm run db:generate

# 运行迁移（开发环境）
npm run db:migrate:dev

# 或直接同步（如果数据库已存在）
npm run db:sync
```

### 2. 手动执行任务

访问前端页面：`/demand-radar`

点击"执行抓取"按钮，系统会：
1. 抓取各平台数据（过去24小时）
2. 提取需求
3. 生成今日榜单

### 3. 通过 API 执行

```bash
POST /api/demand-radar/run
Content-Type: application/json

{
  "platforms": ["reddit", "producthunt", "hackernews"],
  "hoursBack": 24,
  "maxResultsPerPlatform": 100
}
```

### 4. 查看榜单

```bash
GET /api/demand-radar/rankings?date=2024-01-01
```

## ⚙️ 定时任务配置

系统已配置定时任务，每天 UTC 09:00（北京时间 17:00）自动执行。

### Vercel Cron 配置

在 `vercel.json` 中已添加：

```json
{
  "crons": [
    {
      "path": "/api/cron/demand-radar",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 手动触发定时任务

```bash
GET /api/cron/demand-radar
Authorization: Bearer ${CRON_SECRET}
```

## 📊 数据模型

### DemandSource（原始数据源）

存储从各平台抓取的原始内容：

- `platform`: 平台名称（reddit, producthunt, hackernews等）
- `title`: 标题
- `content`: 内容（帖子、评论等）
- `url`: 原始链接
- `author`: 作者
- `upvotes`: 点赞数
- `comments`: 评论数
- `crawledAt`: 抓取时间

### ExtractedDemand（提取的需求）

从原始内容中提取的需求：

- `originalText`: 原始需求句子
- `cleanedText`: 清洗后的文本
- `keywords`: 关键词数组
- `category`: 分类（email, seo, automation等）
- `frequency`: 出现频次

### DemandRanking（每日榜单）

每日生成的 Top 20 榜单：

- `rank`: 排名（1-20）
- `frequency`: 当日频次
- `trend`: 趋势（up/down/stable/new）
- `notes`: 备注（如：中小企业需求强）

## 🔧 配置选项

### 需求提取模式

系统会自动识别以下需求模式：

- `I need a tool that...`
- `Does anyone know a tool for...`
- `I wish there was a tool...`
- `Looking for a tool to...`
- `Need a solution for...`
- `Is there a tool that...`
- `Can someone recommend a tool...`
- `有什么工具可以...`（中文）
- `有没有工具...`（中文）

### 需求分类

系统会自动将需求分类到以下类别：

- `email`: 邮件相关
- `seo`: SEO相关
- `automation`: 自动化
- `analytics`: 数据分析
- `social`: 社交媒体
- `ecommerce`: 电商
- `design`: 设计
- `development`: 开发

## 📈 使用示例

### 查看今日榜单

访问 `/demand-radar` 页面，可以看到：

1. **统计信息**
   - 今日需求数
   - 上升/新增数量
   - 榜单日期

2. **需求榜单**
   - 排名（1-20）
   - 需求描述
   - 频次
   - 趋势（上升/下降/新增/稳定）
   - 分类标签
   - 关键词
   - 备注

### 执行抓取任务

1. 点击"执行抓取"按钮
2. 系统会抓取指定平台的数据
3. 自动提取需求并生成榜单
4. 等待几秒后刷新页面查看结果

## ⚠️ 注意事项

1. **平台限制**
   - Reddit: 使用公开 API，有频率限制
   - Product Hunt: 需要 HTML 解析，可能受反爬虫影响
   - Hacker News: 使用公开 API，较稳定
   - G2/Toolify/Twitter: 需要 API 或特殊处理，当前未实现

2. **数据质量**
   - 需求提取依赖正则表达式，可能遗漏部分需求
   - 关键词提取较简单，可以改进为使用 NLP 库
   - 分类逻辑可以进一步优化

3. **性能考虑**
   - 抓取大量数据可能耗时较长
   - 建议限制每个平台的最大抓取数量
   - 定时任务建议在低峰期执行

## 🔄 后续改进

1. **完善平台爬虫**
   - 实现 G2 差评抓取
   - 实现 Toolify 搜索热度抓取
   - 集成 Twitter API

2. **改进需求提取**
   - 使用 NLP 库（如 spaCy）进行更准确的提取
   - 支持更多语言
   - 改进关键词提取算法

3. **增强分析功能**
   - 需求趋势图表
   - 分类统计
   - 平台对比分析

4. **优化用户体验**
   - 历史榜单查看
   - 需求详情页面
   - 导出功能

## 📝 API 文档

### 执行任务

```typescript
POST /api/demand-radar/run
Body: {
  platforms?: string[]
  hoursBack?: number
  maxResultsPerPlatform?: number
}
Response: {
  success: boolean
  data: {
    taskId: string
    sourcesCount: number
    demandsCount: number
    rankingsCount: number
  }
}
```

### 获取榜单

```typescript
GET /api/demand-radar/rankings?date=2024-01-01
Response: {
  success: boolean
  data: {
    date: string
    rankings: Array<{
      rank: number
      demand: string
      frequency: number
      trend?: string
      notes?: string
      category?: string
      keywords: string[]
    }>
    total: number
  }
}
```

### 获取任务列表

```typescript
GET /api/demand-radar/tasks?limit=10
Response: {
  success: boolean
  data: {
    items: Array<{
      id: string
      status: string
      platforms: string[]
      sourcesCount: number
      demandsCount: number
      rankingsCount: number
      createdAt: string
    }>
    total: number
  }
}
```

---

**最后更新**: 2024-12-XX

