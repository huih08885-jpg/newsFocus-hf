/**
 * 微博热搜爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML, fetchJSON } from '@/lib/utils/fetch-helper'

export class WeiboCrawler implements PlatformCrawler {
  platformId = 'weibo'

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
   * 爬取微博热搜
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Weibo] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Weibo] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取微博热搜
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://s.weibo.com/top/summary'
      const html = await fetchHTML(url, {
        referer: 'https://weibo.com/',
        timeout: 15000,
        proxyFallback: true,
      })

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器
      const selectors = [
        '.td-02 a',
        '.list_a a',
        '.rank_content a',
        '[data-rank] a',
      ]

      for (const selector of selectors) {
        const elements = $(selector)
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (i >= limit) return false

            const $el = $(el)
            const title = $el.text().trim()
            let url = $el.attr('href') || ''
            
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://s.weibo.com', url)
            }

            if (title && url) {
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
      console.error(`[Weibo] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取微博热搜（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 尝试多个API端点
      const apiEndpoints = [
        'https://weibo.com/ajax/side/hotSearch',
        'https://weibo.com/ajax/statuses/hot_band',
        'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot',
      ]

      for (const url of apiEndpoints) {
        try {
          console.log(`[Weibo] 尝试API端点: ${url}`)
          
          const data = await fetchJSON(url, {
            referer: 'https://weibo.com/',
            origin: 'https://weibo.com',
            timeout: 15000,
            retries: 2,
            proxyFallback: true,
          })
          console.log(`[Weibo] API响应数据结构:`, JSON.stringify(data).substring(0, 200))
          
          // 尝试多种数据结构
          let items: NewsItem[] = []
          
          // 结构1: data.data.realtime
          if (data.data?.realtime && Array.isArray(data.data.realtime)) {
            items = data.data.realtime.slice(0, limit).map((item: any, index: number) => ({
              title: item.word || item.word_scheme || item.title || '',
              url: item.url || item.link || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.title || '')}`,
              mobileUrl: item.mobileUrl || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.title || '')}`,
              rank: index + 1,
            })).filter((item: NewsItem) => item.title)
          }
          // 结构2: data.data.band_list
          else if (data.data?.band_list && Array.isArray(data.data.band_list)) {
            items = data.data.band_list.slice(0, limit).map((item: any, index: number) => ({
              title: item.word || item.word_scheme || item.title || '',
              url: item.url || item.link || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.title || '')}`,
              mobileUrl: item.mobileUrl || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.title || '')}`,
              rank: index + 1,
            })).filter((item: NewsItem) => item.title)
          }
          // 结构3: data.data.cards (移动端)
          else if (data.data?.cards && Array.isArray(data.data.cards)) {
            for (const card of data.data.cards) {
              if (card.card_group && Array.isArray(card.card_group)) {
                for (const item of card.card_group) {
                  if (item.desc || item.title) {
                    items.push({
                      title: item.desc || item.title || '',
                      url: item.scheme || item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.desc || item.title || '')}`,
                      rank: items.length + 1,
                    })
                    if (items.length >= limit) break
                  }
                }
              }
              if (items.length >= limit) break
            }
          }
          // 结构4: 直接是数组
          else if (Array.isArray(data.data)) {
            items = data.data.slice(0, limit).map((item: any, index: number) => ({
              title: item.word || item.word_scheme || item.title || item.desc || '',
              url: item.url || item.link || item.scheme || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.title || '')}`,
              rank: index + 1,
            })).filter((item: NewsItem) => item.title)
          }

          if (items.length > 0) {
            console.log(`[Weibo] API成功获取 ${items.length} 条数据`)
            return {
              success: true,
              platformId: this.platformId,
              data: items,
            }
          } else {
            console.warn(`[Weibo] API端点 ${url} 返回了数据，但无法解析出有效项。数据结构:`, JSON.stringify(data).substring(0, 500))
          }
        } catch (endpointError: any) {
          const errorMsg = endpointError?.message || String(endpointError)
          console.error(`[Weibo] API端点 ${url} 失败:`, errorMsg)
          console.error(`[Weibo] 错误详情:`, endpointError)
          continue
        }
      }

      // 如果所有端点都失败，返回详细错误
      // 微博被反爬虫机制阻止（403），需要使用其他方式
      const errorMsg = '微博API被反爬虫机制阻止（403 Forbidden）。建议：1) 使用HTML解析方式 2) 或暂时禁用微博爬虫'
      console.error(`[Weibo] ${errorMsg}`)
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
      console.error(`[Weibo] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索微博内容
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      // 对每个关键词进行搜索
      for (const keyword of keywords) {
        try {
          // 微博搜索 API（可能需要更新）
          const searchUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodeURIComponent(keyword)}&page_type=searchall`
          
          const data = await fetchJSON(searchUrl, {
            referer: `https://m.weibo.cn/search?keyword=${encodeURIComponent(keyword)}`,
            origin: 'https://m.weibo.cn',
            timeout: 15000,
            proxyFallback: true,
          })
          
          // 解析搜索结果
          const cards = data.data?.cards || []
          const items: NewsItem[] = []
          
          for (const card of cards) {
            if (card.card_type === '9' && card.mblog) {
              const mblog = card.mblog
              items.push({
                title: mblog.text_raw || mblog.text || '',
                url: `https://weibo.com/${mblog.user?.id}/${mblog.bid}`,
                mobileUrl: `https://m.weibo.cn/status/${mblog.bid}`,
                rank: results.length + items.length + 1,
              })
              
              if (items.length >= Math.ceil(limit / keywords.length)) break
            }
          }

          results.push(...items)
          
          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Weibo] 搜索关键词 "${keyword}" 错误:`, error)
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
      console.error(`[Weibo] 爬取热点失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

