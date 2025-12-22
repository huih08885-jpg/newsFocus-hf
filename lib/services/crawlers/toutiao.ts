/**
 * 今日头条热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML, fetchJSON } from '@/lib/utils/fetch-helper'

export class ToutiaoCrawler implements PlatformCrawler {
  platformId = 'toutiao'

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
   * 爬取今日头条热点
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Toutiao] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Toutiao] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取今日头条热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.toutiao.com/hot-event/hot-board/'
      const html = await fetchHTML(url, {
        referer: 'https://www.toutiao.com/',
        timeout: 15000,
        proxyFallback: true,
      })

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器
      const selectors = [
        '.hot-item',
        '.hot-list-item',
        '.hot-event-item',
        '[data-article-id]',
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
              'h3',
              'a.title',
              '[data-title]',
            ]) || $el.find('a').text().trim()

            // 提取URL
            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.toutiao.com', url)
            }

            // 提取文章ID（如果有）
            const articleId = $el.attr('data-article-id') || url.match(/article\/(\d+)/)?.[1] || ''
            if (!url && articleId) {
              url = `https://www.toutiao.com/article/${articleId}`
            }

            if (title && url) {
              items.push({
                title,
                url,
                mobileUrl: url.replace('www.toutiao.com', 'm.toutiao.com'),
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      if (!foundItems) {
        console.warn('[Toutiao] HTML解析：未找到有效的选择器，页面结构可能已变更')
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
      console.error(`[Toutiao] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取今日头条热点（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 尝试多个API端点
      const apiEndpoints = [
        'https://www.toutiao.com/api/pc/feed/',
        'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
      ]

      for (const url of apiEndpoints) {
        try {
          console.log(`[Toutiao] 尝试API端点: ${url}`)
          
          const data = await fetchJSON(url, {
            referer: 'https://www.toutiao.com/',
            origin: 'https://www.toutiao.com',
            timeout: 15000,
            retries: 2,
            proxyFallback: true,
          })
          
          console.log(`[Toutiao] API响应数据结构:`, JSON.stringify(data).substring(0, 200))
          
          // 尝试多种数据结构
          let items: NewsItem[] = []
          
          // 结构1: data.data (feed流)
          if (data.data && Array.isArray(data.data)) {
            items = data.data.slice(0, limit).map((item: any, index: number) => {
              const articleId = item.item_id || item.cluster_id || item.group_id || ''
              const articleUrl = item.article_url || item.url || (articleId ? `https://www.toutiao.com/article/${articleId}` : '')
              return {
                title: item.title || item.Title || item.abstract || '',
                url: articleUrl,
                mobileUrl: item.mobileUrl || item.MobileUrl || (articleId ? `https://m.toutiao.com/article/${articleId}` : ''),
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }
          // 结构2: data.list
          else if (data.list && Array.isArray(data.list)) {
            items = data.list.slice(0, limit).map((item: any, index: number) => {
              const articleId = item.item_id || item.cluster_id || item.group_id || ''
              const articleUrl = item.article_url || item.url || (articleId ? `https://www.toutiao.com/article/${articleId}` : '')
              return {
                title: item.title || item.Title || item.abstract || '',
                url: articleUrl,
                mobileUrl: item.mobileUrl || item.MobileUrl || (articleId ? `https://m.toutiao.com/article/${articleId}` : ''),
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }
          // 结构3: 直接是数组
          else if (Array.isArray(data)) {
            items = data.slice(0, limit).map((item: any, index: number) => {
              const articleId = item.item_id || item.cluster_id || item.group_id || ''
              const articleUrl = item.article_url || item.url || (articleId ? `https://www.toutiao.com/article/${articleId}` : '')
              return {
                title: item.title || item.Title || item.abstract || '',
                url: articleUrl,
                mobileUrl: item.mobileUrl || item.MobileUrl || (articleId ? `https://m.toutiao.com/article/${articleId}` : ''),
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }

          if (items.length > 0) {
            console.log(`[Toutiao] API成功获取 ${items.length} 条数据`)
            return {
              success: true,
              platformId: this.platformId,
              data: items,
            }
          } else {
            console.warn(`[Toutiao] API端点 ${url} 返回了数据，但无法解析出有效项。数据结构:`, JSON.stringify(data).substring(0, 500))
          }
        } catch (endpointError: any) {
          const errorMsg = endpointError?.message || String(endpointError)
          console.error(`[Toutiao] API端点 ${url} 失败:`, errorMsg)
          console.error(`[Toutiao] 错误详情:`, endpointError)
          continue
        }
      }

      // 如果所有端点都失败，返回详细错误
      const errorMsg = '所有API端点都失败或返回空数据。可能原因：1) API需要认证 2) 反爬虫机制 3) 数据结构已变更'
      console.error(`[Toutiao] ${errorMsg}`)
      throw new Error(errorMsg)
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
      console.error(`[Toutiao] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索今日头条内容
   * 优先使用HTML解析，API作为备选
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.searchByKeywordsHTML(keywords, limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Toutiao] HTML搜索成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Toutiao] HTML搜索失败或未获取到数据，尝试API...`)
    return await this.searchByKeywordsAPI(keywords, limit)
  }

  /**
   * HTML解析方式搜索今日头条
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.toutiao.com/search/?keyword=${encodeURIComponent(keyword)}`
          const html = await fetchHTML(searchUrl, {
            referer: 'https://www.toutiao.com/',
            timeout: 15000,
            proxyFallback: true,
          })

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.article-item, .search-result-item, [data-article-id]').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              '.title',
              'h3 a',
              'a.title',
            ])

            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.toutiao.com', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                mobileUrl: url.replace('www.toutiao.com', 'm.toutiao.com'),
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Toutiao] HTML搜索关键词 "${keyword}" 错误:`, error)
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
   * API方式搜索今日头条（备选方案）
   */
  private async searchByKeywordsAPI(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          // 今日头条搜索 API
          const searchUrl = `https://www.toutiao.com/api/search/content/?keyword=${encodeURIComponent(keyword)}&autoload=true&count=20&cur_tab=1`
          
          const data = await fetchJSON(searchUrl, {
            referer: `https://www.toutiao.com/search/?keyword=${encodeURIComponent(keyword)}`,
            origin: 'https://www.toutiao.com',
            timeout: 15000,
            proxyFallback: true,
          })
          
          const items: NewsItem[] = (data.data || [])
            .slice(0, Math.ceil(limit / keywords.length))
            .map((item: any, index: number) => ({
              title: item.title || item.article_title || '',
              url: item.article_url || `https://www.toutiao.com/article/${item.item_id}`,
              mobileUrl: item.article_url || `https://m.toutiao.com/article/${item.item_id}`,
              rank: results.length + index + 1,
            }))
            .filter((item: NewsItem) => item.title)

          results.push(...items)
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Toutiao] 搜索关键词 "${keyword}" 错误:`, error)
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
      console.error(`[Toutiao] API搜索失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

