/**
 * 百度热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML, fetchJSON } from '@/lib/utils/fetch-helper'

export class BaiduCrawler implements PlatformCrawler {
  platformId = 'baidu'

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
   * 爬取百度热点
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Baidu] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Baidu] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取百度热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://top.baidu.com/board?tab=realtime'
      const html = await fetchHTML(url, {
        referer: 'https://www.baidu.com/',
        timeout: 15000,
        proxyFallback: true,
      })

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器
      const selectors = [
        '.c-single-text-ellipsis',
        '.list_1 .c-single-text-ellipsis',
        '.content_1YVWB .c-single-text-ellipsis',
      ]

      for (const selector of selectors) {
        const elements = $(selector)
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (i >= limit) return false

            const $el = $(el)
            const title = $el.text().trim()
            const link = $el.closest('a').attr('href') || $el.find('a').attr('href') || ''
            let url = link
            
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://top.baidu.com', url)
            } else if (!url) {
              url = `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`
            }

            if (title) {
              items.push({
                title,
                url,
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      return {
        success: items.length > 0,
        platformId: this.platformId,
        data: items.slice(0, limit),
        error: items.length === 0 ? 'HTML解析未获取到数据' : undefined,
      }
    } catch (error) {
      console.error(`[Baidu] HTML解析失败:`, error)
      let errorMessage = 'HTML解析失败'
      if (error instanceof Error) {
        if (error.message) {
          errorMessage = `HTML解析失败: ${error.message}`
        } else if (error.name) {
          errorMessage = `HTML解析失败: ${error.name}`
        }
      } else if (typeof error === 'string') {
        errorMessage = `HTML解析失败: ${error}`
      }
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取百度热点（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 尝试多个API端点
      const apiEndpoints = [
        'https://top.baidu.com/api/board?platform=wise&tab=realtime',
        'https://top.baidu.com/api/board?platform=pc&tab=realtime',
        'https://top.baidu.com/api/board?tab=realtime',
      ]

      for (const url of apiEndpoints) {
        try {
          console.log(`[Baidu] 尝试API端点: ${url}`)
          
          const data = await fetchJSON(url, {
            referer: 'https://top.baidu.com/board',
            origin: 'https://top.baidu.com',
            timeout: 15000,
            retries: 2,
            proxyFallback: true,
          })
          console.log(`[Baidu] API响应数据结构:`, JSON.stringify(data).substring(0, 200))
          
          // 尝试多种数据结构
          let items: NewsItem[] = []
          
          // 结构1: data.data.cards[0].content (这是实际的数据结构)
          if (data.data?.cards && Array.isArray(data.data.cards)) {
            // 找到 component 为 "hotList" 的 card
            const hotListCard = data.data.cards.find((card: any) => card.component === 'hotList')
            if (hotListCard?.content && Array.isArray(hotListCard.content)) {
              items = hotListCard.content.slice(0, limit).map((item: any, index: number) => ({
                title: item.word || item.query || item.title || '',
                url: item.url || item.rawUrl || item.appUrl || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
                mobileUrl: item.appUrl || item.mobileUrl || item.url || `https://m.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
                rank: index + 1,
              })).filter((item: NewsItem) => item.title)
            }
          }
          // 结构2: data.data.cards[0].content (兼容旧结构)
          else if (data.data?.cards?.[0]?.content && Array.isArray(data.data.cards[0].content)) {
            items = data.data.cards[0].content.slice(0, limit).map((item: any, index: number) => ({
              title: item.word || item.query || item.title || '',
              url: item.url || item.rawUrl || item.appUrl || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
              mobileUrl: item.appUrl || item.mobileUrl || item.url || `https://m.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
              rank: index + 1,
            })).filter((item: NewsItem) => item.title)
          }
          // 结构3: data.cards[0].content (兼容旧结构)
          else if (data.cards?.[0]?.content && Array.isArray(data.cards[0].content)) {
            items = data.cards[0].content.slice(0, limit).map((item: any, index: number) => ({
              title: item.word || item.query || item.title || '',
              url: item.url || item.rawUrl || item.appUrl || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
              mobileUrl: item.appUrl || item.mobileUrl || item.url || `https://m.baidu.com/s?wd=${encodeURIComponent(item.word || item.query || item.title || '')}`,
              rank: index + 1,
            })).filter((item: NewsItem) => item.title)
          }

          if (items.length > 0) {
            console.log(`[Baidu] API成功获取 ${items.length} 条数据`)
            return {
              success: true,
              platformId: this.platformId,
              data: items,
            }
          } else {
            console.warn(`[Baidu] API端点 ${url} 返回了数据，但无法解析出有效项。数据结构:`, JSON.stringify(data).substring(0, 500))
          }
        } catch (endpointError: any) {
          const errorMsg = endpointError?.message || String(endpointError)
          console.error(`[Baidu] API端点 ${url} 失败:`, errorMsg)
          console.error(`[Baidu] 错误详情:`, endpointError)
          continue
        }
      }

      // 如果所有端点都失败，返回详细错误
      const errorMsg = '所有API端点都失败或返回空数据。可能原因：1) API需要认证 2) 反爬虫机制 3) 数据结构已变更'
      console.error(`[Baidu] ${errorMsg}`)
      throw new Error(errorMsg)
    } catch (error) {
      return {
        success: false,
        platformId: this.platformId,
        error: this.formatError(error, 'API请求失败'),
      }
    }
  }

  /**
   * 根据关键词搜索百度内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 百度搜索主要使用HTML解析（因为百度搜索本身就是HTML页面）
    return await this.searchByKeywordsHTML(keywords, limit)
  }

  /**
   * HTML解析方式搜索百度
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&tn=news&rtt=1&bsst=1&cl=2&medium=0`
          
          const html = await fetchHTML(searchUrl, {
            referer: 'https://www.baidu.com/',
            timeout: 15000,
            proxyFallback: true,
            checkRobots: false, // 搜索引擎搜索功能跳过 robots.txt 检查
          })

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.result, .c-result').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              'h3 a',
              '.c-title-text',
              '.t a',
            ])

            let url = $el.find('h3 a, .c-title-text, .t a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.baidu.com', url)
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
          console.error(`[Baidu] HTML搜索关键词 "${keyword}" 错误:`, error)
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
        error: this.formatError(error, 'API请求失败'),
      }
    }
  }

  /**
   * 格式化错误信息
   */
  private formatError(error: unknown, defaultMessage: string): string {
    if (error instanceof Error) {
      const message = error.message
      if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
        return `网络请求失败: ${message}`
      } else if (message.includes('JSON') || message.includes('Unexpected token')) {
        return `数据解析失败: ${message}`
      } else if (message.includes('HTTP')) {
        return `HTTP错误: ${message}`
      }
      return message || defaultMessage
    } else if (typeof error === 'string') {
      return error
    }
    return defaultMessage
  }
}

