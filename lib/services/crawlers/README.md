# 平台爬虫实现指南

## 架构说明

系统现在使用**平台爬虫架构**，每个平台都有独立的爬虫实现，直接爬取各平台的官方 API 或网页，而不是依赖外部第三方 API。

## 目录结构

```
lib/services/crawlers/
├── base.ts          # 基础接口和类型定义
├── index.ts         # 爬虫注册表
├── zhihu.ts         # 知乎爬虫
├── weibo.ts         # 微博爬虫
├── baidu.ts         # 百度爬虫
├── bilibili.ts      # B站爬虫
├── douyin.ts        # 抖音爬虫
└── README.md        # 本文档
```

## 如何添加新平台爬虫

### 1. 创建爬虫文件

在 `lib/services/crawlers/` 目录下创建新文件，例如 `toutiao.ts`：

```typescript
import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class ToutiaoCrawler implements PlatformCrawler {
  platformId = 'toutiao'

  async crawl(): Promise<CrawlResult> {
    try {
      // 实现爬取逻辑
      const url = 'https://api.toutiao.com/...'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 ...',
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析数据
      const items: NewsItem[] = (data.items || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || '',
        mobileUrl: item.mobileUrl || '',
        rank: index + 1,
      })).filter((item: NewsItem) => item.title)

      return {
        success: true,
        platformId: this.platformId,
        data: items,
      }
    } catch (error) {
      return {
        success: false,
        platformId: this.platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
```

### 2. 注册爬虫

在 `lib/services/crawlers/index.ts` 中注册新爬虫：

```typescript
import { ToutiaoCrawler } from './toutiao'

const crawlers: Map<string, () => PlatformCrawler> = new Map([
  // ... 其他爬虫
  ['toutiao', () => new ToutiaoCrawler()],
])
```

## 已实现的平台

- ✅ 知乎 (zhihu)
- ✅ 微博 (weibo)
- ✅ 百度 (baidu)
- ✅ B站 (bilibili)
- ✅ 抖音 (douyin)

## 待实现的平台

- ⏳ 今日头条 (toutiao)
- ⏳ 小红书 (redbook)
- ⏳ 网易 (netease)
- ⏳ 新浪 (sina)
- ⏳ QQ (qq)
- ⏳ 豆瓣 (douban)

## 注意事项

1. **API 变更**：各平台的 API 可能会变更，需要定期检查和更新
2. **反爬虫**：某些平台可能有反爬虫机制，需要：
   - 设置合适的 User-Agent
   - 控制请求频率
   - 可能需要 Cookie 或 Token
3. **错误处理**：每个爬虫都应该有完善的错误处理
4. **数据格式**：确保返回的数据格式符合 `NewsItem` 接口要求

## 测试爬虫

可以单独测试某个平台的爬虫：

```typescript
import { getCrawler } from '@/lib/services/crawlers'

const crawler = getCrawler('zhihu')
if (crawler) {
  const result = await crawler.crawl()
  console.log(result)
}
```

