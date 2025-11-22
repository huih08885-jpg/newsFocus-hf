/**
 * 新浪热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class SinaCrawler implements PlatformCrawler {
  platformId = 'sina'

  async crawl(): Promise<CrawlResult> {
    try {
      // 新浪热点 API
      const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=1'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://news.sina.com.cn/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析新浪热点数据
      const items: NewsItem[] = (data.result?.data || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || item.link || '',
        mobileUrl: item.mobileUrl || item.url || item.link || '',
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

