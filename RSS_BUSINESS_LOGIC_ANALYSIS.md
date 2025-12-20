# RSS 订阅业务逻辑分析

## 📋 业务概述

RSS 订阅功能是 NewsFocus 系统的内容分发模块，允许用户根据关键词组和平台筛选条件，生成个性化的 RSS Feed，供 RSS 阅读器订阅。

## 🔄 完整业务流程

### 1. 数据准备阶段（上游业务）

#### 1.1 新闻爬取流程
```
爬虫服务 (CrawlerService)
  ↓
爬取各平台热点新闻
  ↓
保存到 NewsItem 表
  - platformId: 平台ID
  - title: 新闻标题
  - url/mobileUrl: 新闻链接
  - rank: 排名
  - crawledAt: 爬取时间
  - sentiment: 情感分析结果（可选）
```

#### 1.2 关键词匹配流程
```
新闻爬取完成后
  ↓
MatcherService.matchTitle()
  ↓
检查新闻标题是否匹配关键词组
  ↓
匹配规则：
  1. 普通词匹配（words）：标题包含任意一个词即可
  2. 必须词匹配（requiredWords）：标题必须包含所有必须词
  3. 过滤词排除（excludedWords）：标题包含过滤词则排除
  ↓
如果匹配成功
  ↓
创建/更新 NewsMatch 记录
  - newsItemId: 新闻ID
  - keywordGroupId: 关键词组ID
  - weight: 权重分数（基于排名、出现次数计算）
  - matchCount: 匹配次数
  - firstMatchedAt: 首次匹配时间
  - lastMatchedAt: 最后匹配时间
```

**关键业务规则**：
- 一条新闻可以匹配多个关键词组（一对多关系）
- 匹配记录通过 `newsItemId + keywordGroupId` 唯一约束防止重复
- 权重计算考虑：排名、出现次数、时间衰减等因素

### 2. Feed 创建阶段

#### 2.1 用户创建 Feed 流程
```
用户访问 /rss 页面
  ↓
点击"创建 Feed"按钮
  ↓
填写 Feed 配置：
  - name: Feed 名称（必填）
  - description: Feed 描述（可选）
  - keywordGroupIds: 关键词组ID列表（可选，多选）
  - platformIds: 平台ID列表（可选，多选）
  ↓
提交到 POST /api/rss/feed
  ↓
RSSService.createFeed()
  ↓
生成 Feed ID（当前实现：Base64 编码配置JSON）
  ↓
返回 Feed 信息：
  - feedId: Feed ID
  - feedUrl: 完整的 Feed URL
  - 其他配置信息
```

**当前实现问题**：
- Feed 配置未持久化到数据库
- Feed ID 通过 Base64 编码生成，不安全且冗长
- 页面刷新后 Feed 列表丢失

#### 2.2 Feed ID 生成逻辑（当前实现）
```typescript
generateFeedId(userId, name, options) {
  const config = JSON.stringify({
    userId,
    name,
    keywordGroupIds: options.keywordGroupIds || [],
    platformIds: options.platformIds || [],
  })
  // Base64 编码并移除特殊字符
  return Buffer.from(config).toString('base64').replace(/[+/=]/g, '')
}
```

**问题分析**：
- 配置信息暴露在 URL 中
- 容易被解码和篡改
- 无法验证 Feed 所有权

### 3. Feed 生成阶段（核心业务逻辑）

#### 3.1 Feed 访问流程
```
RSS 阅读器请求 Feed URL
  GET /api/rss/[feedId]?keywordGroupIds=...&platformIds=...&limit=50
  ↓
RSSService.generateFeed()
  ↓
根据配置筛选新闻
  ↓
生成 RSS 2.0 XML
  ↓
返回给 RSS 阅读器
```

#### 3.2 数据筛选逻辑（核心业务规则）

**场景 1：有关键词组筛选**
```typescript
if (keywordGroupIds.length > 0) {
  // 通过 NewsMatch 表查询匹配的新闻
  const matches = await prisma.newsMatch.findMany({
    where: {
      keywordGroupId: { in: keywordGroupIds },  // 多关键词组：OR 关系
      newsItem: {
        crawledAt: { gte: 最近7天 },
        platformId: { in: platformIds }  // 平台筛选（如果指定）
      }
    },
    include: {
      newsItem: { include: { platform: true } },
      keywordGroup: true
    },
    orderBy: {
      newsItem: { crawledAt: 'desc' }  // 按爬取时间倒序
    },
    take: limit  // 限制数量（默认50，最大100）
  })
}
```

**业务规则**：
- **多关键词组关系**：OR 关系（新闻匹配任意一个关键词组即可）
- **时间范围**：默认最近 7 天（硬编码）
- **平台筛选**：如果指定平台，在 NewsItem 层面筛选
- **排序规则**：按 `crawledAt` 倒序（最新优先）
- **去重逻辑**：如果一条新闻匹配多个关键词组，会返回多条记录（但新闻内容相同）

**场景 2：无关键词组筛选**
```typescript
else {
  // 直接查询 NewsItem 表
  const newsItems = await prisma.newsItem.findMany({
    where: {
      crawledAt: { gte: 最近7天 },
      platformId: { in: platformIds }  // 平台筛选（如果指定）
    },
    include: {
      platform: true
    },
    orderBy: {
      crawledAt: 'desc'
    },
    take: limit
  })
}
```

**业务规则**：
- 返回所有平台的新闻（如果未指定平台）
- 或返回指定平台的新闻
- 同样按时间倒序排列

#### 3.3 数据去重问题

**当前实现的问题**：
- 如果一条新闻匹配多个关键词组，会生成多个 RSS Item
- 例如：新闻 A 同时匹配"AI"和"科技"两个关键词组，Feed 中会出现两次

**可能的解决方案**：
1. 在查询后对 `newsItemId` 去重
2. 使用 `DISTINCT` 或 `GROUP BY` 在数据库层面去重
3. 在应用层使用 Map 去重

#### 3.4 RSS Item 生成逻辑

```typescript
generateRSSItem(newsItem) {
  return {
    title: newsItem.title,
    link: newsItem.url || newsItem.mobileUrl || 详情页链接,
    description: 生成HTML描述,
    pubDate: newsItem.crawledAt,
    guid: 唯一标识（基于新闻ID）
  }
}
```

**描述内容包含**：
- 新闻标题
- 平台名称
- 排名信息
- 情感分析结果（如果有）
- 关键词组名称（如果有关键词组筛选）
- 爬取时间

#### 3.5 RSS XML 生成

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed 标题</title>
    <description>Feed 描述</description>
    <link>Feed 链接</link>
    <lastBuildDate>当前时间</lastBuildDate>
    <pubDate>当前时间</pubDate>
    <generator>NewsFocus RSS Generator</generator>
    <language>zh-CN</language>
    <item>
      <title><![CDATA[新闻标题]]></title>
      <link>新闻链接</link>
      <description><![CDATA[HTML描述]]></description>
      <pubDate>发布时间</pubDate>
      <guid isPermaLink="false">唯一标识</guid>
    </item>
    ...
  </channel>
</rss>
```

**技术细节**：
- 使用 CDATA 包裹标题和描述，避免 XML 转义问题
- 使用 `escapeXML()` 方法转义链接中的特殊字符
- 时间格式：UTC 时间字符串

## 🔗 与其他业务模块的关系

### 1. 与关键词匹配系统的关系

**依赖关系**：
- RSS 订阅功能**完全依赖**关键词匹配系统
- 如果关键词组筛选，必须通过 `NewsMatch` 表查询
- 没有关键词匹配，RSS 只能返回所有新闻（无筛选能力）

**数据流**：
```
关键词组配置 (KeywordGroup)
  ↓
新闻爬取 (NewsItem)
  ↓
关键词匹配 (MatcherService)
  ↓
匹配记录 (NewsMatch)
  ↓
RSS Feed 生成 (RSSService)
```

### 2. 与爬虫系统的关系

**依赖关系**：
- RSS 订阅依赖爬虫系统提供新闻数据
- 新闻数据存储在 `NewsItem` 表
- RSS Feed 的时间范围受爬虫数据影响

**数据时效性**：
- 默认返回最近 7 天的新闻
- 如果爬虫停止运行，Feed 内容会过时
- 需要爬虫持续运行以保持 Feed 更新

### 3. 与平台配置的关系

**依赖关系**：
- RSS 订阅可以按平台筛选
- 平台信息来自 `Platform` 表
- 只有启用的平台才会在 Feed 创建界面显示

### 4. 与用户系统的关系

**当前实现**：
- Feed 创建需要用户登录
- 但 Feed 访问不需要认证（公开访问）
- 无法区分 Feed 的所有者

**问题**：
- 任何知道 Feed URL 的人都可以访问
- 无法实现私有 Feed
- 无法统计 Feed 的使用情况

## 📊 业务规则总结

### 筛选规则

| 筛选条件 | 关系 | 说明 |
|---------|------|------|
| 多个关键词组 | OR | 新闻匹配任意一个关键词组即可 |
| 多个平台 | OR | 新闻来自任意一个平台即可 |
| 关键词组 + 平台 | AND | 必须同时满足两个条件 |

### 时间规则

- **默认时间范围**：最近 7 天（硬编码）
- **排序规则**：按 `crawledAt` 倒序（最新优先）
- **时间字段**：使用 `crawledAt`（爬取时间），而非 `publishedAt`（发布时间）

### 数量限制

- **默认数量**：50 条
- **最大数量**：100 条
- **限制位置**：在数据库查询时使用 `take: limit`

### 数据来源

1. **有关键词组**：从 `NewsMatch` 表查询（通过关联查询 `NewsItem`）
2. **无关键词组**：直接从 `NewsItem` 表查询

## ⚠️ 业务逻辑问题分析

### 1. 数据去重问题 ⚠️

**问题**：一条新闻匹配多个关键词组时，会在 Feed 中重复出现

**影响**：
- Feed 内容冗余
- 用户体验差
- 占用不必要的带宽

**解决方案**：
```typescript
// 在查询后去重
const uniqueNewsItems = new Map()
matches.forEach(match => {
  if (!uniqueNewsItems.has(match.newsItemId)) {
    uniqueNewsItems.set(match.newsItemId, match.newsItem)
  }
})
const newsItems = Array.from(uniqueNewsItems.values())
```

### 2. 时间范围硬编码 ⚠️

**问题**：时间范围固定为 7 天，无法自定义

**影响**：
- 无法获取更早的新闻
- 无法获取更近期的新闻（如最近 1 天）
- 灵活性差

**解决方案**：
- 在 Feed 配置中添加 `timeRange` 字段
- 允许用户自定义时间范围（如：1天、7天、30天、全部）

### 3. 排序规则单一 ⚠️

**问题**：只能按时间排序，无法按权重、排名等排序

**影响**：
- 无法突出重要新闻
- 无法按相关性排序

**解决方案**：
- 添加排序选项：时间、权重、排名
- 在 Feed 配置中允许用户选择排序方式

### 4. 平台筛选逻辑问题 ⚠️

**问题**：当有关键词组时，平台筛选在 `NewsItem` 层面，可能导致筛选不准确

**影响**：
- 如果一条新闻在多个平台出现，筛选可能不符合预期

**解决方案**：
- 明确平台筛选的业务含义
- 考虑是否需要支持"新闻来源平台"和"新闻出现平台"两种筛选

### 5. Feed 访问控制缺失 ⚠️

**问题**：Feed 完全公开，无法实现私有 Feed

**影响**：
- 无法保护用户隐私
- 无法实现付费订阅
- 无法统计 Feed 使用情况

**解决方案**：
- 添加 Feed 访问控制（公开/私有）
- 私有 Feed 需要 Token 认证
- 记录 Feed 访问日志

## 🎯 业务价值分析

### 1. 用户价值

- **个性化订阅**：用户可以根据兴趣创建专属 Feed
- **多平台聚合**：一个 Feed 包含多个平台的新闻
- **关键词筛选**：只关注感兴趣的话题
- **RSS 阅读器集成**：使用熟悉的工具阅读新闻

### 2. 系统价值

- **内容分发**：将系统内容分发到外部
- **用户留存**：通过 RSS 订阅增加用户粘性
- **数据利用**：充分利用关键词匹配系统的结果

### 3. 商业价值

- **潜在变现**：可以推出高级 Feed 功能（付费）
- **数据洞察**：分析 Feed 订阅情况，了解用户兴趣
- **品牌推广**：Feed 中包含系统信息，提升品牌曝光

## 📝 改进建议

### 短期改进（高优先级）

1. **数据持久化**
   - 添加 `RSSFeed` 数据库模型
   - 实现 Feed 的 CRUD 操作
   - 持久化 Feed 配置

2. **数据去重**
   - 在 Feed 生成时对新闻去重
   - 确保每条新闻只出现一次

3. **Feed 管理**
   - 添加编辑和删除功能
   - 添加 Feed 列表查询 API

### 中期改进（中优先级）

1. **时间范围自定义**
   - 允许用户选择时间范围
   - 支持多种预设选项

2. **排序选项**
   - 支持多种排序方式
   - 允许用户自定义排序

3. **访问控制**
   - 实现 Feed 公开/私有设置
   - 添加 Token 认证机制

### 长期改进（低优先级）

1. **Feed 统计**
   - 记录 Feed 访问日志
   - 统计订阅数和访问量
   - 提供使用分析

2. **高级功能**
   - Feed 分类和标签
   - Feed 分享功能
   - Feed 订阅通知

3. **性能优化**
   - Feed 缓存策略优化
   - 增量更新支持
   - 数据库查询优化

## 🔍 技术架构建议

### 当前架构
```
前端 (app/rss/page.tsx)
  ↓
API (app/api/rss/feed, app/api/rss/[feedId])
  ↓
服务层 (lib/services/rss.ts)
  ↓
数据层 (Prisma + PostgreSQL)
  - NewsItem
  - NewsMatch
  - KeywordGroup
  - Platform
```

### 建议架构
```
前端 (app/rss/page.tsx)
  ↓
API (app/api/rss/feeds, app/api/rss/[feedId])
  ↓
服务层 (lib/services/rss.ts)
  ↓
数据层 (Prisma + PostgreSQL)
  - RSSFeed (新增)
  - NewsItem
  - NewsMatch
  - KeywordGroup
  - Platform
  - RSSFeedAccessLog (新增，用于统计)
```

## 📌 总结

RSS 订阅功能的核心业务逻辑是：

1. **数据筛选**：通过关键词组和平台筛选新闻
2. **数据聚合**：将筛选结果聚合成 RSS Feed
3. **内容分发**：以 RSS 2.0 格式提供给 RSS 阅读器

**关键依赖**：
- 关键词匹配系统（提供筛选能力）
- 爬虫系统（提供数据源）
- 平台配置（提供平台信息）

**主要问题**：
- 数据持久化缺失
- 数据去重问题
- 时间范围硬编码
- 访问控制缺失

**改进方向**：
- 完善数据模型和持久化
- 优化筛选和排序逻辑
- 增强 Feed 管理功能
- 添加访问控制和统计

