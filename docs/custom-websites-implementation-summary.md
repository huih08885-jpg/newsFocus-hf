# 关键词组自定义网站爬取功能 - 实现总结

## ✅ 已完成

### 1. 数据库 Schema
- ✅ 在 `KeywordGroup` 模型中添加了 `customWebsites` 字段（JSON类型）
- ✅ 创建了 SQL 迁移脚本

### 2. 爬虫服务
- ✅ 修改了 `CrawlerService.crawlAllPlatforms` 方法
- ✅ 支持从关键词组的 `customWebsites` 读取网站配置
- ✅ 使用 `ConfigurableHtmlCrawler` 爬取自定义网站
- ✅ 自定义网站使用其关联的关键词组的关键词进行搜索
- ✅ 自定义网站的数据会关联到对应的关键词组

## 📋 待实现

### 1. API 修改
- [ ] 修改 `app/api/config/keywords/route.ts`，支持保存和读取 `customWebsites`
- [ ] 添加验证逻辑，确保网站配置格式正确

### 2. 前端 UI
- [ ] 在关键词设置页面添加"自定义网站"配置区域
- [ ] 支持添加、编辑、删除网站配置
- [ ] 网站配置表单包括：
  - 网站名称
  - 是否启用
  - 基础URL
  - 列表页URL和选择器配置
  - 搜索页URL和选择器配置（可选）
  - 字段映射（title, url, publishedAt等）

### 3. 测试
- [ ] 测试自定义网站爬取功能
- [ ] 测试关键词匹配功能
- [ ] 测试错误处理

## 📝 数据结构

### CustomWebsite
```typescript
interface CustomWebsite {
  id: string                    // 网站唯一标识（自动生成）
  name: string                 // 网站名称
  enabled: boolean             // 是否启用
  config: ConfigurableHtmlCrawlerConfig
}
```

### ConfigurableHtmlCrawlerConfig
```typescript
interface ConfigurableHtmlCrawlerConfig {
  type: 'html'
  baseUrl?: string
  list: HtmlListConfig
  search?: HtmlListConfig       // 可选，如果支持关键词搜索
}
```

## 🔄 工作流程

1. 用户在关键词设置页面配置自定义网站
2. 保存时，网站配置存储到 `KeywordGroup.customWebsites`（JSON数组）
3. 爬取时：
   - 系统读取关键词组的 `customWebsites`
   - 为每个启用的网站创建临时平台对象
   - 使用 `ConfigurableHtmlCrawler` 爬取数据
   - 使用关键词组的关键词进行搜索（如果网站支持）
   - 保存数据并关联到关键词组

## 🎯 下一步

1. 实现 API 修改
2. 实现前端 UI
3. 测试功能

