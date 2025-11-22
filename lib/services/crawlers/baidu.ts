/**
 * 百度热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class BaiduCrawler implements PlatformCrawler {
  platformId = 'baidu'

  async crawl(): Promise<CrawlResult> {
    try {
      // 百度热点 API
      const url = 'https://top.baidu.com/api/board?platform=wise&tab=realtime'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://top.baidu.com/board',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析百度热点数据
      const items: NewsItem[] = (data.data?.cards?.[0]?.content || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.word || item.query || '',
        url: item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || '')}`,
        mobileUrl: item.mobileUrl || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || '')}`,
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

