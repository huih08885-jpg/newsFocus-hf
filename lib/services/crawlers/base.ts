/**
 * 爬虫基础接口和类型定义
 */

export interface NewsItem {
  title: string
  url?: string
  mobileUrl?: string
  content?: string
  publishedAt?: Date | string | null
  rank: number
}

export interface CrawlResult {
  success: boolean
  platformId: string
  data?: NewsItem[]
  error?: string
}

export interface CrawlOptions {
  /**
   * 关键词列表（用于搜索模式）
   */
  keywords?: string[]
  
  /**
   * 爬取模式：'hot' 热点模式，'search' 搜索模式
   */
  mode?: 'hot' | 'search'
  
  /**
   * 搜索数量限制
   */
  limit?: number
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
   * 爬取平台的热点新闻（兼容旧接口）
   * @returns 爬取结果
   */
  crawl(): Promise<CrawlResult>

  /**
   * 爬取平台数据（支持关键词搜索）
   * @param options 爬取选项
   * @returns 爬取结果
   */
  crawlWithOptions?(options?: CrawlOptions): Promise<CrawlResult>
}

