/**
 * 微博热搜爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class WeiboCrawler implements PlatformCrawler {
  platformId = 'weibo'

  async crawl(): Promise<CrawlResult> {
    try {
      // 微博热搜 API
      // 注意：微博可能需要特殊处理，这里提供一个基础实现
      const url = 'https://weibo.com/ajax/side/hotSearch'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://weibo.com/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析微博热搜数据
      const items: NewsItem[] = (data.data?.realtime || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.word || item.word_scheme || '',
        url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
        mobileUrl: item.mobileUrl || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
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

