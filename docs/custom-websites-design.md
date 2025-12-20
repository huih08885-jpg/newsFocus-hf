# 关键词组自定义网站爬取功能设计

## 功能概述

允许用户在关键词组中配置自定义网站，系统会使用 HTML 爬取方式从这些网站获取数据。

## 数据结构

### KeywordGroup.customWebsites (JSON)

```typescript
interface CustomWebsite {
  id: string                    // 网站唯一标识
  name: string                 // 网站名称（显示用）
  enabled: boolean             // 是否启用
  config: ConfigurableHtmlCrawlerConfig  // 爬虫配置
}

type CustomWebsites = CustomWebsite[]
```

### ConfigurableHtmlCrawlerConfig

```typescript
interface ConfigurableHtmlCrawlerConfig {
  type: 'html'
  baseUrl?: string
  list: HtmlListConfig          // 列表页配置
  search?: HtmlListConfig       // 搜索页配置（可选，如果支持关键词搜索）
}
```

## 工作流程

1. **配置阶段**：
   - 用户在关键词设置页面添加自定义网站
   - 配置网站的爬虫参数（URL、选择器、字段映射等）
   - 保存到 `KeywordGroup.customWebsites`

2. **爬取阶段**：
   - 系统爬取时，读取关键词组的 `customWebsites`
   - 为每个启用的网站创建临时平台记录
   - 使用 `ConfigurableHtmlCrawler` 爬取数据
   - 使用关键词组的关键词进行搜索（如果网站支持搜索）

3. **数据保存**：
   - 爬取的数据保存到 `news_items` 表
   - 使用临时平台ID（格式：`custom-{keywordGroupId}-{websiteId}`）
   - 自动进行关键词匹配

## 实现要点

1. **临时平台管理**：
   - 不需要在 `platforms` 表中创建记录
   - 在内存中创建临时平台对象
   - 使用 `ConfigurableHtmlCrawler` 直接爬取

2. **关键词搜索**：
   - 如果网站配置了 `search`，使用关键词进行搜索
   - 否则只爬取列表页数据

3. **错误处理**：
   - 网站爬取失败不影响其他网站
   - 错误信息记录在失败平台列表中

