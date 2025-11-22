/**
 * 知乎热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class ZhihuCrawler implements PlatformCrawler {
  platformId = 'zhihu'

  async crawl(): Promise<CrawlResult> {
    try {
      // 知乎热榜 API（可能需要更新）
      // 注意：知乎可能会更新 API，需要根据实际情况调整
      const url = 'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析知乎热榜数据
      const items: NewsItem[] = (data.data || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.target?.title || item.title || '',
        url: item.target?.url || `https://www.zhihu.com/question/${item.target?.id}`,
        mobileUrl: item.target?.url || `https://www.zhihu.com/question/${item.target?.id}`,
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

