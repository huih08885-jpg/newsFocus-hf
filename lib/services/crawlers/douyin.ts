/**
 * 抖音热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'

export class DouyinCrawler implements PlatformCrawler {
  platformId = 'douyin'

  async crawl(): Promise<CrawlResult> {
    return this.crawlWithOptions({ mode: 'hot' })
  }

  async crawlWithOptions(options?: CrawlOptions): Promise<CrawlResult> {
    const { keywords, mode = 'hot', limit = 10 } = options || {}

    if (mode === 'search' && keywords && keywords.length > 0) {
      return this.searchByKeywords(keywords, limit)
    }

    return this.crawlHotList(limit)
  }

  /**
   * 爬取抖音热点
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Douyin] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Douyin] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取抖音热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.douyin.com/aweme/v1/web/hot/search/list/'
      // 尝试访问抖音热搜页面
      const html = await fetch('https://www.douyin.com/hot', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      }).then(r => r.text())

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器（抖音页面结构可能动态加载，需要尝试多种选择器）
      const selectors = [
        '.hot-search-item',
        '.hot-item',
        '[data-e2e="hot-search-item"]',
        '.rank-item',
        '.trending-item',
      ]

      let foundItems = false
      for (const selector of selectors) {
        const elements = $(selector)
        if (elements.length > 0) {
          foundItems = true
          elements.each((i, el) => {
            if (i >= limit) return false

            const $el = $(el)
            
            // 提取标题
            const title = HTMLParser.extractTextWithFallback($el, [
              '.title',
              'h3',
              'a',
              '[data-e2e="hot-search-title"]',
            ]) || $el.text().trim()

            // 提取URL
            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.douyin.com', url)
            } else if (!url && title) {
              url = `https://www.douyin.com/search/${encodeURIComponent(title)}`
            }

            if (title) {
              items.push({
                title,
                url,
                mobileUrl: url.replace('www.douyin.com', 'm.douyin.com'),
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      if (!foundItems) {
        console.warn('[Douyin] HTML解析：未找到有效的选择器，页面结构可能已变更或需要JavaScript渲染')
      }

      return {
        success: items.length > 0,
        platformId: this.platformId,
        data: items.slice(0, limit),
        error: items.length === 0 ? 'HTML解析未获取到数据' : undefined,
      }
    } catch (error) {
      let errorMessage = '未知错误'
      if (error instanceof Error) {
        errorMessage = error.message
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          errorMessage = `网络请求失败: ${error.message}`
        } else if (error.message.includes('cheerio') || error.message.includes('Cannot find module')) {
          errorMessage = `HTML解析器模块未找到: ${error.message}`
        } else if (error.message.includes('parse') || error.message.includes('Unexpected token')) {
          errorMessage = `HTML解析失败: ${error.message}`
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      console.error(`[Douyin] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取抖音热点（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 抖音热点可能需要通过网页爬取或使用官方API
      // 这里提供一个基础实现，实际使用时可能需要调整
      const url = 'https://www.douyin.com/aweme/v1/web/hot/search/list/'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.douyin.com/',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析抖音热点数据（需要根据实际API响应调整）
      const items: NewsItem[] = (data.data?.word_list || []).slice(0, 10).map((item: any, index: number) => ({
        title: item.word || item.title || '',
        url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.word || '')}`,
        mobileUrl: item.mobileUrl || `https://www.douyin.com/search/${encodeURIComponent(item.word || '')}`,
        rank: index + 1,
      })).filter((item: NewsItem) => item.title)

      return {
        success: true,
        platformId: this.platformId,
        data: items,
      }
    } catch (error) {
      let errorMessage = '未知错误'
      if (error instanceof Error) {
        errorMessage = error.message
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          errorMessage = `网络请求失败: ${error.message}`
        } else if (error.message.includes('JSON') || error.message.includes('Unexpected token')) {
          errorMessage = `数据解析失败: ${error.message}`
        } else if (error.message.includes('HTTP')) {
          errorMessage = `HTTP错误: ${error.message}`
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      console.error(`[Douyin] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索抖音内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.searchByKeywordsHTML(keywords, limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Douyin] HTML搜索成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，回退到热点模式
    console.log(`[Douyin] HTML搜索失败，回退到热点模式...`)
    return this.crawlHotList(limit)
  }

  /**
   * HTML解析方式搜索抖音
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(keyword)}`
          const html = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html',
            },
          }).then(r => r.text())

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.video-item, .search-result-item, [data-e2e="search-result"]').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              '.title',
              'h3',
              '[data-e2e="search-result-title"]',
            ])

            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.douyin.com', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                mobileUrl: url.replace('www.douyin.com', 'm.douyin.com'),
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Douyin] HTML搜索关键词 "${keyword}" 错误:`, error)
        }
      }

      return {
        success: results.length > 0,
        platformId: this.platformId,
        data: results.slice(0, limit),
      }
    } catch (error) {
      let errorMessage = '未知错误'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

