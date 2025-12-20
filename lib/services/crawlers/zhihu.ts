/**
 * 知乎热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'

export class ZhihuCrawler implements PlatformCrawler {
  platformId = 'zhihu'

  /**
   * 格式化错误信息
   */
  private formatError(error: unknown, defaultMessage: string): string {
    if (error instanceof Error) {
      if (error.message) {
        return `${defaultMessage}: ${error.message}`
      } else if (error.name) {
        return `${defaultMessage}: ${error.name}`
      }
    } else if (typeof error === 'string') {
      return `${defaultMessage}: ${error}`
    }
    return defaultMessage
  }

  async crawl(): Promise<CrawlResult> {
    return this.crawlWithOptions({ mode: 'hot' })
  }

  async crawlWithOptions(options?: CrawlOptions): Promise<CrawlResult> {
    const { keywords, mode = 'hot', limit = 10 } = options || {}

    // 如果指定了关键词且模式为搜索，使用搜索模式
    if (mode === 'search' && keywords && keywords.length > 0) {
      return this.searchByKeywords(keywords, limit)
    }

    // 否则使用热点模式
    return this.crawlHotList(limit)
  }

  /**
   * 爬取知乎热榜
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Zhihu] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Zhihu] HTML解析失败或未获取到数据，尝试API...`)
    const apiResult = await this.crawlHotListAPI(limit)
    if (apiResult.success && apiResult.data && apiResult.data.length > 0) {
      console.log(`[Zhihu] API解析成功，获取到 ${apiResult.data.length} 条新闻`)
      return apiResult
    }

    // 3. 都失败了，返回HTML解析的错误（因为HTML是优先方案）
    return htmlResult
  }

  /**
   * HTML解析方式爬取知乎热榜
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.zhihu.com/hot'
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      }).then(r => r.text())

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器（适应不同的HTML结构）
      const selectors = [
        '.HotList-item',
        '.HotItem',
        '[data-za-detail-view-id="HotList"] .HotList-item',
        '.Topstory-container .HotList-item',
      ]

      let foundItems = false
      for (const selector of selectors) {
        const elements = $(selector)
        if (elements.length > 0) {
          foundItems = true
          elements.each((i, el) => {
            if (i >= limit) return false

            const $el = $(el)
            
            // 提取标题（尝试多个选择器）
            const title = HTMLParser.extractTextWithFallback($el, [
              '.HotItem-title',
              '.title',
              'h2',
              '[data-za-detail-view-element_name="Title"]',
            ])

            // 提取URL
            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.zhihu.com', url)
            }

            // 提取排名
            const rankText = HTMLParser.extractTextWithFallback($el, [
              '.HotItem-rank',
              '.rank',
              '[data-rank]',
            ])
            const rank = parseInt(rankText) || i + 1

            if (title && url) {
              items.push({
                title,
                url,
                rank,
              })
            }
          })
          break // 找到有效的选择器就退出
        }
      }

      if (!foundItems) {
        console.warn('[Zhihu] HTML解析：未找到有效的选择器，页面结构可能已变更')
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
      console.error(`[Zhihu] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取知乎热榜（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true'
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 解析知乎热榜数据
      const items: NewsItem[] = (data.data || []).slice(0, limit).map((item: any, index: number) => ({
        title: item.target?.title || item.title || '',
        url: item.target?.url || `https://www.zhihu.com/question/${item.target?.id}`,
        mobileUrl: item.target?.url || `https://www.zhihu.com/question/${item.target?.id}`,
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
      console.error(`[Zhihu] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索知乎内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.searchByKeywordsHTML(keywords, limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Zhihu] HTML搜索成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Zhihu] HTML搜索失败或未获取到数据，尝试API...`)
    return await this.searchByKeywordsAPI(keywords, limit)
  }

  /**
   * HTML解析方式搜索
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.zhihu.com/search?q=${encodeURIComponent(keyword)}&type=content`
          const html = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html',
            },
          }).then(r => r.text())

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.ContentItem, .SearchResult-Card').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              '.ContentItem-title',
              '.SearchResult-title',
              'h2 a',
            ])

            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.zhihu.com', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Zhihu] HTML搜索关键词 "${keyword}" 错误:`, error)
        }
      }

      return {
        success: results.length > 0,
        platformId: this.platformId,
        data: results.slice(0, limit),
      }
    } catch (error) {
      return {
        success: false,
        platformId: this.platformId,
        error: this.formatError(error, '搜索失败'),
      }
    }
  }

  /**
   * API方式搜索（备选方案）
   */
  private async searchByKeywordsAPI(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(keyword)}&correction=1&offset=0&limit=10&lc_idx=0&show_all_topics=0`
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': `https://www.zhihu.com/search?q=${encodeURIComponent(keyword)}`,
            },
          })

          if (!response.ok) {
            console.warn(`[Zhihu] API搜索关键词 "${keyword}" 失败: HTTP ${response.status}`)
            continue
          }

          const data = await response.json()
          
          const items = (data.data || [])
            .filter((item: any) => item.object?.type === 'answer' || item.object?.type === 'article')
            .slice(0, Math.ceil(limit / keywords.length))
            .map((item: any, index: number) => {
              const obj = item.object
              return {
                title: obj.title || obj.question?.title || '',
                url: obj.url || `https://www.zhihu.com/question/${obj.question?.id}`,
                mobileUrl: obj.url || `https://www.zhihu.com/question/${obj.question?.id}`,
                rank: results.length + index + 1,
              }
            })
            .filter((item: NewsItem) => item.title)

          results.push(...items)
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Zhihu] API搜索关键词 "${keyword}" 错误:`, error)
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
      console.error(`[Zhihu] API搜索失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

