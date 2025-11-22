/**
 * 网易热点爬虫
 */

import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class NeteaseCrawler implements PlatformCrawler {
  platformId = 'netease'

  async crawl(): Promise<CrawlResult> {
    try {
      // 网易新闻热点 API
      const url = 'https://3g.163.com/touch/reconstruct/article/list/BA8EE5GMwangning/0-10.html'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.163.com/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      // 网易返回的是 JSONP 格式，需要解析
      const jsonMatch = text.match(/\(({.*})\)/)
      const data = jsonMatch ? JSON.parse(jsonMatch[1]) : {}
      
      // 解析网易热点数据
      const items: NewsItem[] = (data.BA8EE5GMwangning || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || item.link || '',
        mobileUrl: item.url || item.link || '',
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

