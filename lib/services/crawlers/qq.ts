/**
 * 腾讯新闻热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class QQCrawler implements PlatformCrawler {
  platformId = 'qq'

  async crawl(): Promise<CrawlResult> {
    try {
      // 腾讯新闻热点 API
      const url = 'https://r.inews.qq.com/gw/event/hot_ranking_list?ids_hash=&offset=0&page_size=20'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://news.qq.com/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析腾讯新闻热点数据
      const items: NewsItem[] = (data.idlist?.[0]?.newslist || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || item.surl || '',
        mobileUrl: item.mobileUrl || item.url || item.surl || '',
        rank: item.rank || index + 1,
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

