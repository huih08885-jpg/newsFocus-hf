/**
 * 小红书热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML, fetchJSON } from '@/lib/utils/fetch-helper'

export class RedbookCrawler implements PlatformCrawler {
  platformId = 'redbook'

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
   * 爬取小红书热点
   * 优先使用API，HTML解析作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试API（小红书页面需要JavaScript渲染，HTML解析通常失败）
    const apiResult = await this.crawlHotListAPI(limit)
    if (apiResult.success && apiResult.data && apiResult.data.length > 0) {
      console.log(`[Redbook] API解析成功，获取到 ${apiResult.data.length} 条新闻`)
      return apiResult
    }

    // 2. API失败，尝试HTML解析
    console.log(`[Redbook] API解析失败或未获取到数据，尝试HTML解析...`)
    return await this.crawlHotListHTML(limit)
  }

  /**
   * HTML解析方式爬取小红书热点
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.xiaohongshu.com/explore'
      const html = await fetchHTML(url, {
        referer: 'https://www.xiaohongshu.com/',
        timeout: 15000,
        proxyFallback: true,
      })

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器（小红书页面可能需要JavaScript渲染，这里尝试静态HTML）
      const selectors = [
        '.note-item',
        '.feed-item',
        '.explore-item',
        '[data-note-id]',
        '.card-item',
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
              url = HTMLParser.resolveUrl('https://www.xiaohongshu.com', url)
            }

            // 提取笔记ID（如果有）
            const noteId = $el.attr('data-note-id') || url.match(/explore\/(\w+)/)?.[1] || ''
            if (!url && noteId) {
              url = `https://www.xiaohongshu.com/explore/${noteId}`
            }

            if (title && url) {
              items.push({
                title,
                url,
                mobileUrl: url,
                rank: items.length + 1,
              })
            }
          })
          break
        }
      }

      if (!foundItems) {
        console.warn('[Redbook] HTML解析：未找到有效的选择器，页面可能需要JavaScript渲染或结构已变更')
      }

      return {
        success: items.length > 0,
        platformId: this.platformId,
        data: items.slice(0, limit),
        error: items.length === 0 ? 'HTML解析未获取到数据（小红书页面可能需要JavaScript渲染）' : undefined,
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
      console.error(`[Redbook] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取小红书热点（主要方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 小红书API端点（可能需要更新）
      const apiEndpoints = [
        'https://edith.xiaohongshu.com/api/sns/web/v1/feed?source=explore_feed',
        'https://edith.xiaohongshu.com/api/sns/web/v1/note/explore',
      ]

      for (const url of apiEndpoints) {
        try {
          console.log(`[Redbook] 尝试API端点: ${url}`)
          
          const data = await fetchJSON(url, {
            referer: 'https://www.xiaohongshu.com/',
            origin: 'https://www.xiaohongshu.com',
            timeout: 15000,
            retries: 2,
            proxyFallback: true,
          })
          
          console.log(`[Redbook] API响应数据结构:`, JSON.stringify(data).substring(0, 200))
          
          // 尝试多种数据结构
          let items: NewsItem[] = []
          
          // 结构1: data.data.items
          if (data.data?.items && Array.isArray(data.data.items)) {
            items = data.data.items.slice(0, limit).map((item: any, index: number) => {
              const noteCard = item.note_card || item
              return {
                title: noteCard.title || noteCard.desc || noteCard.display_title || '',
                url: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                mobileUrl: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }
          // 结构2: data.items
          else if (data.items && Array.isArray(data.items)) {
            items = data.items.slice(0, limit).map((item: any, index: number) => {
              const noteCard = item.note_card || item
              return {
                title: noteCard.title || noteCard.desc || noteCard.display_title || '',
                url: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                mobileUrl: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }
          // 结构3: data.data (直接是数组)
          else if (Array.isArray(data.data)) {
            items = data.data.slice(0, limit).map((item: any, index: number) => {
              const noteCard = item.note_card || item
              return {
                title: noteCard.title || noteCard.desc || noteCard.display_title || '',
                url: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                mobileUrl: noteCard.note_id ? `https://www.xiaohongshu.com/explore/${noteCard.note_id}` : '',
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)
          }

          if (items.length > 0) {
            console.log(`[Redbook] API成功获取 ${items.length} 条数据`)
            return {
              success: true,
              platformId: this.platformId,
              data: items,
            }
          } else {
            console.warn(`[Redbook] API端点 ${url} 返回了数据，但无法解析出有效项。数据结构:`, JSON.stringify(data).substring(0, 500))
          }
        } catch (endpointError: any) {
          const errorMsg = endpointError?.message || String(endpointError)
          // 小红书API可能需要认证，记录认证错误
          if (errorMsg.includes('401') || errorMsg.includes('403')) {
            console.warn(`[Redbook] API端点 ${url} 需要认证 (${errorMsg})`)
          } else {
            console.error(`[Redbook] API端点 ${url} 失败:`, errorMsg)
            console.error(`[Redbook] 错误详情:`, endpointError)
          }
          continue
        }
      }

      // 如果所有端点都失败，返回详细错误
      const errorMsg = '所有API端点都失败或需要认证。小红书页面需要JavaScript渲染，HTML解析通常无法获取数据。建议：1) 使用无头浏览器 2) 使用官方API（需要认证）'
      console.error(`[Redbook] ${errorMsg}`)
      throw new Error(errorMsg)
    } catch (error) {
      let errorMessage = '未知错误'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      console.error(`[Redbook] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索小红书内容
   * 优先使用HTML解析
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    return await this.searchByKeywordsHTML(keywords, limit)
  }

  /**
   * HTML解析方式搜索小红书
   */
  private async searchByKeywordsHTML(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`
          const html = await fetchHTML(searchUrl, {
            referer: 'https://www.xiaohongshu.com/',
            timeout: 15000,
            proxyFallback: true,
          })

          const $ = HTMLParser.parse(html)
          
          // 提取搜索结果
          $('.search-result-item, .note-item, [data-note-id]').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = HTMLParser.extractTextWithFallback($el, [
              '.title',
              'h3',
              'a.title',
            ])

            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.xiaohongshu.com', url)
            }

            if (title && url) {
              results.push({
                title,
                url,
                mobileUrl: url,
                rank: results.length + 1,
              })
            }
          })

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Redbook] HTML搜索关键词 "${keyword}" 错误:`, error)
        }
      }

      return {
        success: results.length > 0,
        platformId: this.platformId,
        data: results.slice(0, limit),
        error: results.length === 0 ? 'HTML解析未获取到数据（小红书页面可能需要JavaScript渲染）' : undefined,
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

