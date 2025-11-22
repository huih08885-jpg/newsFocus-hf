# 爬虫架构说明

## 重要变更

**系统已移除对外部 API (`https://newsnow.busiyi.world/api/s`) 的依赖**

现在系统使用**平台爬虫架构**，直接爬取各个平台的官方 API 或网页。

## 架构设计

### 1. 平台爬虫接口

每个平台实现 `PlatformCrawler` 接口：

```typescript
interface PlatformCrawler {
  platformId: string
  crawl(): Promise<CrawlResult>
}
```

### 2. 爬虫注册表

所有平台的爬虫在 `lib/services/crawlers/index.ts` 中注册。

### 3. CrawlerService

`CrawlerService` 现在：
- 不再调用外部 API
- 使用平台爬虫注册表获取对应平台的爬虫
- 调用平台爬虫的 `crawl()` 方法

## 已实现的平台

- ✅ 知乎：使用知乎热榜 API
- ✅ 微博：使用微博热搜 API
- ✅ 百度：使用百度热点 API
- ✅ B站：使用 B站热门 API
- ✅ 抖音：使用抖音热点 API（可能需要调整）

## 如何添加新平台

1. 在 `lib/services/crawlers/` 目录下创建新的爬虫文件
2. 实现 `PlatformCrawler` 接口
3. 在 `lib/services/crawlers/index.ts` 中注册

详细说明请参考 `lib/services/crawlers/README.md`

## 环境变量

不再需要以下环境变量：
- ~~`CRAWLER_API_URL`~~（已移除）
- ~~`PROXY_URL`~~（如需要可在平台爬虫中单独配置）

## 迁移说明

如果之前依赖外部 API，现在需要：

1. **确保所有平台都有对应的爬虫实现**
2. **测试每个平台的爬虫是否正常工作**
3. **根据实际情况调整 API 端点或爬取方式**

## 常见问题

### Q: 某个平台的 API 不可用怎么办？

A: 可以：
1. 检查平台是否有新的 API 端点
2. 考虑使用网页爬取（需要 HTML 解析）
3. 暂时禁用该平台（在数据库中设置 `enabled = false`）

### Q: 如何调试平台爬虫？

A: 可以单独测试：
```typescript
import { getCrawler } from '@/lib/services/crawlers'
const crawler = getCrawler('zhihu')
const result = await crawler.crawl()
console.log(result)
```

### Q: 平台 API 需要认证怎么办？

A: 在对应平台的爬虫实现中添加认证逻辑，例如：
- Cookie
- Token
- API Key

