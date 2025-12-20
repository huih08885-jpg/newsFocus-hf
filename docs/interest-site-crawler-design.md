# 兴趣站点爬虫模块设计文档

## 1. 功能概述

兴趣站点爬虫模块用于管理从"发现站点"中添加的站点，支持：
1. 展示站点基本信息
2. 使用 DeepSeek AI 分析 HTML 结构，自动生成爬虫配置
3. 支持本日爬虫和按时间段爬虫
4. 爬虫结果展示（全部 + 按分组标签页）
5. 站点分组管理

## 2. 数据库设计

### 2.1 站点分组表 (site_groups)

```prisma
model SiteGroup {
  id          String   @id @default(uuid())
  name        String   // 分组名称
  description String?  // 分组描述
  color       String?  // 分组颜色（用于UI显示）
  order       Int      @default(0) // 排序
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  sites       SiteCandidate[]
  
  @@map("site_groups")
}
```

### 2.2 扩展 SiteCandidate 模型

在现有 `SiteCandidate` 基础上添加：
- `groupId`: 分组ID（外键）
- `analysisStatus`: 分析状态（pending, analyzing, success, failed）
- `analysisResult`: DeepSeek 分析结果（JSON）
- `analysisError`: 分析错误信息
- `lastAnalyzedAt`: 最后分析时间
- `lastCrawledAt`: 最后爬虫时间
- `crawlEnabled`: 是否启用爬虫

### 2.3 站点爬虫任务表 (site_crawl_tasks)

```prisma
model SiteCrawlTask {
  id            String   @id @default(uuid())
  siteId        String   // 站点ID
  type          String   // 爬虫类型：today, range
  startDate     DateTime? // 开始日期（range类型）
  endDate       DateTime? // 结束日期（range类型）
  status        String   @default("pending") // pending, running, completed, failed
  resultCount   Int      @default(0) // 爬取结果数量
  errorMessage  String?  // 错误信息
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  
  site          SiteCandidate @relation(fields: [siteId], references: [id])
  results       SiteCrawlResult[]
  
  @@index([siteId])
  @@index([status])
  @@index([createdAt])
  @@map("site_crawl_tasks")
}
```

### 2.4 站点爬虫结果表 (site_crawl_results)

```prisma
model SiteCrawlResult {
  id          String   @id @default(uuid())
  taskId      String   // 任务ID
  siteId      String   // 站点ID
  title       String   // 新闻标题
  url         String   // 新闻URL
  summary     String?  // 摘要
  publishedAt DateTime? // 发布时间
  crawledAt   DateTime @default(now()) // 爬取时间
  metadata    Json?    // 额外元数据
  
  task        SiteCrawlTask @relation(fields: [taskId], references: [id])
  site        SiteCandidate @relation(fields: [siteId], references: [id])
  
  @@index([taskId])
  @@index([siteId])
  @@index([crawledAt])
  @@index([publishedAt])
  @@map("site_crawl_results")
}
```

## 3. API 设计

### 3.1 站点管理 API

- `GET /api/sites` - 获取站点列表（支持分组筛选）
- `GET /api/sites/:id` - 获取站点详情
- `PUT /api/sites/:id` - 更新站点信息
- `DELETE /api/sites/:id` - 删除站点

### 3.2 分组管理 API

- `GET /api/sites/groups` - 获取所有分组
- `POST /api/sites/groups` - 创建分组
- `PUT /api/sites/groups/:id` - 更新分组
- `DELETE /api/sites/groups/:id` - 删除分组
- `POST /api/sites/:id/group` - 将站点添加到分组

### 3.3 爬虫分析 API

- `POST /api/sites/:id/analyze` - 使用 DeepSeek 分析 HTML 结构
- `GET /api/sites/:id/analysis` - 获取分析结果

### 3.4 爬虫执行 API

- `POST /api/sites/crawl` - 执行爬虫（支持批量）
  - 参数：`siteIds`, `type` (today/range), `startDate`, `endDate`
- `GET /api/sites/crawl/tasks` - 获取爬虫任务列表
- `GET /api/sites/crawl/tasks/:id` - 获取任务详情

### 3.5 爬虫结果 API

- `GET /api/sites/crawl/results` - 获取爬虫结果
  - 参数：`siteId`, `groupId`, `taskId`, `startDate`, `endDate`, `page`, `pageSize`
- `GET /api/sites/crawl/results/stats` - 获取统计信息

## 4. DeepSeek API 集成

### 4.1 Prompt 设计

分析 HTML 结构的 Prompt 模板：

```
你是一个专业的网页爬虫配置专家。请分析以下网页的HTML结构，提取新闻列表的爬虫配置。

网页URL: {url}
网页HTML: {html}

请分析并返回JSON格式的爬虫配置，包含：
1. list.url: 列表页URL
2. list.itemSelector: 新闻项的选择器
3. list.fields.title: 标题选择器
4. list.fields.url: URL选择器（相对路径或绝对路径）
5. list.fields.publishedAt: 发布时间选择器（可选）
6. list.fields.summary: 摘要选择器（可选）

返回格式：
{
  "list": {
    "url": "...",
    "itemSelector": "...",
    "fields": {
      "title": { "selector": "..." },
      "url": { "selector": "...", "attribute": "href" },
      "publishedAt": { "selector": "..." },
      "summary": { "selector": "..." }
    }
  }
}
```

## 5. 前端页面设计

### 5.1 站点列表页面 (`/app/sites/page.tsx`)

- 顶部：搜索框、筛选器（按分组、状态）
- 左侧：分组列表（可折叠）
- 主区域：站点卡片列表
  - 显示：域名、标题、状态、最后爬取时间
  - 操作：分析、爬虫、编辑、删除

### 5.2 站点详情/配置页面

- 基本信息展示
- 分组选择
- 爬虫配置展示/编辑
- 分析历史
- 爬虫历史

### 5.3 爬虫结果页面 (`/app/sites/results/page.tsx`)

- 顶部：时间筛选、站点筛选
- 标签页：全部、按分组显示
- 结果列表：标题、URL、发布时间、来源站点

## 6. 实现步骤

1. ✅ 数据库模型设计
2. ⏳ 创建 SQL 迁移脚本
3. ⏳ DeepSeek API 集成服务
4. ⏳ 站点管理 API
5. ⏳ 分组管理 API
6. ⏳ 爬虫分析 API
7. ⏳ 爬虫执行服务
8. ⏳ 前端页面实现

