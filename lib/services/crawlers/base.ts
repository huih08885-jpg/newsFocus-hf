/**
 * 爬虫基础接口和类型定义
 */

export interface NewsItem {
  title: string
  url?: string
  mobileUrl?: string
  rank: number
}

export interface CrawlResult {
  success: boolean
  platformId: string
  data?: NewsItem[]
  error?: string
}

/**
 * 平台爬虫接口
 * 每个平台需要实现此接口
 */
export interface PlatformCrawler {
  /**
   * 平台ID
   */
  platformId: string

  /**
   * 爬取平台的热点新闻
   * @returns 爬取结果
   */
  crawl(): Promise<CrawlResult>
}

