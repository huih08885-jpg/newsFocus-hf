/**
 * 网易热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'

export class NeteaseCrawler implements PlatformCrawler {
  platformId = 'netease'

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
   * 爬取网易热点
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Netease] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Netease] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取网易热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.163.com/news/'
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      }).then(r => r.text())

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器
      const selectors = [
        '.news-item',
        '.news-list-item',
        '.hot-news-item',
        '[data-news-id]',
        '.list-item',
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
              'h3 a',
              'a.title',
              'h2 a',
            ]) || $el.find('a').text().trim()

            // 提取URL
            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.163.com', url)
            }

            if (title && url) {
              items.push({
                title,
                url,
                mobileUrl: url.replace('www.163.com', '3g.163.com'),
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      if (!foundItems) {
        console.warn('[Netease] HTML解析：未找到有效的选择器，页面结构可能已变更')
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
      console.error(`[Netease] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取网易热点（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
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
      console.error(`[Netease] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索网易新闻内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.searchByKeywordsHTML(keywords, limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Netease] HTML搜索成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Netease] HTML搜索失败或未获取到数据，尝试API...`)
    return await this.searchByKeywordsAPI(keywords, limit)
  }

  /**
   * HTML解析方式搜索网易
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.163.com/search?keyword=${encodeURIComponent(keyword)}`
          const html = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html',
            },
          }).then(r => r.text())

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.search-result-item, .news-item, [data-news-id]').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              '.title',
              'h3 a',
              'a.title',
            ])

            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.163.com', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                mobileUrl: url.replace('www.163.com', '3g.163.com'),
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Netease] HTML搜索关键词 "${keyword}" 错误:`, error)
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

  /**
   * API方式搜索网易（备选方案）
   */
  private async searchByKeywordsAPI(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          // 网易新闻搜索 API
          const searchUrl = `https://3g.163.com/touch/reconstruct/article/list/BA8EE5GMwangning/0-20.html?keyword=${encodeURIComponent(keyword)}`
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': `https://www.163.com/search?keyword=${encodeURIComponent(keyword)}`,
            },
          })

          if (!response.ok) {
            console.warn(`[Netease] 搜索关键词 "${keyword}" 失败: HTTP ${response.status}`)
            continue
          }

          const text = await response.text()
          const jsonMatch = text.match(/\(({.*})\)/)
          const data = jsonMatch ? JSON.parse(jsonMatch[1]) : {}
          
          const items: NewsItem[] = (data.BA8EE5GMwangning || [])
            .slice(0, Math.ceil(limit / keywords.length))
            .map((item: any, index: number) => ({
              title: item.title || '',
              url: item.url || item.link || '',
              mobileUrl: item.url || item.link || '',
              rank: results.length + index + 1,
            }))
            .filter((item: NewsItem) => item.title)

          results.push(...items)
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Netease] 搜索关键词 "${keyword}" 错误:`, error)
        }
      }

      return {
        success: true,
        platformId: this.platformId,
        data: results.slice(0, limit),
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
      console.error(`[Netease] API搜索失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

