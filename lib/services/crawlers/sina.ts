/**
 * 新浪热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'

export class SinaCrawler implements PlatformCrawler {
  platformId = 'sina'

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
   * 爬取新浪热点
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Sina] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Sina] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取新浪热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://news.sina.com.cn/'
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
              url = HTMLParser.resolveUrl('https://news.sina.com.cn', url)
            }

            if (title && url) {
              items.push({
                title,
                url,
                mobileUrl: url.replace('news.sina.com.cn', 'news.sina.cn'),
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      if (!foundItems) {
        console.warn('[Sina] HTML解析：未找到有效的选择器，页面结构可能已变更')
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
      console.error(`[Sina] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取新浪热点（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
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
      console.error(`[Sina] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索新浪新闻内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.searchByKeywordsHTML(keywords, limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Sina] HTML搜索成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Sina] HTML搜索失败或未获取到数据，尝试API...`)
    return await this.searchByKeywordsAPI(keywords, limit)
  }

  /**
   * HTML解析方式搜索新浪
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://news.sina.com.cn/search?q=${encodeURIComponent(keyword)}`
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
              url = HTMLParser.resolveUrl('https://news.sina.com.cn', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                mobileUrl: url.replace('news.sina.com.cn', 'news.sina.cn'),
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Sina] HTML搜索关键词 "${keyword}" 错误:`, error)
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
   * API方式搜索新浪（备选方案）
   */
  private async searchByKeywordsAPI(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          // 新浪新闻搜索 API
          const searchUrl = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=${encodeURIComponent(keyword)}&num=20&page=1`
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': `https://news.sina.com.cn/search?q=${encodeURIComponent(keyword)}`,
            },
          })

          if (!response.ok) {
            console.warn(`[Sina] 搜索关键词 "${keyword}" 失败: HTTP ${response.status}`)
            continue
          }

          const data = await response.json()
          
          const items: NewsItem[] = (data.result?.data || [])
            .slice(0, Math.ceil(limit / keywords.length))
            .map((item: any, index: number) => ({
              title: item.title || '',
              url: item.url || item.link || '',
              mobileUrl: item.mobileUrl || item.url || item.link || '',
              rank: results.length + index + 1,
            }))
            .filter((item: NewsItem) => item.title)

          results.push(...items)
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Sina] 搜索关键词 "${keyword}" 错误:`, error)
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
      console.error(`[Sina] API搜索失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

