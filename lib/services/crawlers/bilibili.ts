/**
 * B站热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class BilibiliCrawler implements PlatformCrawler {
  platformId = 'bilibili'

  async crawl(): Promise<CrawlResult> {
    try {
      // B站热门 API
      const url = 'https://api.bilibili.com/x/web-interface/popular'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.bilibili.com/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析B站热门数据
      const items: NewsItem[] = (data.data?.list || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.title || '',
        url: `https://www.bilibili.com/video/${item.bvid}`,
        mobileUrl: `https://m.bilibili.com/video/${item.bvid}`,
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

