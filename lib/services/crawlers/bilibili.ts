/**
 * B站热点爬虫
 * 优先使用HTML解析，API作为备选
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML, fetchJSON } from '@/lib/utils/fetch-helper'

export class BilibiliCrawler implements PlatformCrawler {
  platformId = 'bilibili'

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
   * 爬取B站热门
   * 优先使用HTML解析，API作为备选
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    // 1. 优先尝试HTML解析
    const htmlResult = await this.crawlHotListHTML(limit)
    if (htmlResult.success && htmlResult.data && htmlResult.data.length > 0) {
      console.log(`[Bilibili] HTML解析成功，获取到 ${htmlResult.data.length} 条新闻`)
      return htmlResult
    }

    // 2. HTML解析失败，尝试API
    console.log(`[Bilibili] HTML解析失败或未获取到数据，尝试API...`)
    return await this.crawlHotListAPI(limit)
  }

  /**
   * HTML解析方式爬取B站热门
   */
  private async crawlHotListHTML(limit: number = 10): Promise<CrawlResult> {
    try {
      const url = 'https://www.bilibili.com/v/popular/all/'
      const html = await fetchHTML(url, {
        referer: 'https://www.bilibili.com/',
        timeout: 15000,
        proxyFallback: true,
      })

      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []

      // 尝试多种选择器（适应不同的HTML结构）
      const selectors = [
        '.popular-video-card',
        '.video-card',
        '.bili-video-card',
        '[data-video-id]',
        '.rank-item',
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
              '.video-name',
              '.title',
              'h3',
              'a[title]',
              '.bili-video-card__info--tit',
            ]) || $el.find('a').attr('title') || ''

            // 提取URL
            let url = $el.find('a').attr('href') || ''
            if (url && !url.startsWith('http')) {
              url = HTMLParser.resolveUrl('https://www.bilibili.com', url)
            }

            // 提取BVID（如果有）
            const bvid = url.match(/\/video\/(BV\w+)/)?.[1] || 
                        $el.attr('data-video-id') || 
                        $el.find('[data-bvid]').attr('data-bvid') || ''

            if (title && (url || bvid)) {
              const finalUrl = url || (bvid ? `https://www.bilibili.com/video/${bvid}` : '')
              items.push({
                title,
                url: finalUrl,
                mobileUrl: finalUrl.replace('www.bilibili.com', 'm.bilibili.com'),
                rank: items.length + 1,
              })
            }
          })
          break // 找到有效的选择器就退出
        }
      }

      if (!foundItems) {
        console.warn('[Bilibili] HTML解析：未找到有效的选择器，页面结构可能已变更')
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
      console.error(`[Bilibili] HTML解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * API方式爬取B站热门（备选方案）
   */
  private async crawlHotListAPI(limit: number = 10): Promise<CrawlResult> {
    try {
      // 尝试多个API端点
      const apiEndpoints = [
        { url: 'https://api.bilibili.com/x/web-interface/popular', dataPath: 'data.list' },
        { url: 'https://api.bilibili.com/x/web-interface/popular/series?number=1', dataPath: 'data.list' },
        { url: 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', dataPath: 'data.list' },
      ]

      for (const endpoint of apiEndpoints) {
        try {
          console.log(`[Bilibili] 尝试API端点: ${endpoint.url}`)
          
          const data = await fetchJSON(endpoint.url, {
            referer: 'https://www.bilibili.com/',
            origin: 'https://www.bilibili.com',
            timeout: 15000,
            retries: 2,
            proxyFallback: true,
          })
          console.log(`[Bilibili] API响应数据结构:`, JSON.stringify(data).substring(0, 200))
          
          // 解析数据路径
          const pathParts = endpoint.dataPath.split('.')
          let listData: any[] = data
          for (const part of pathParts) {
            listData = listData?.[part]
          }

          if (!Array.isArray(listData)) {
            // 尝试其他可能的数据结构
            listData = data.data?.list || data.list || data.data || []
          }

          if (Array.isArray(listData) && listData.length > 0) {
            const items: NewsItem[] = listData.slice(0, limit).map((item: any, index: number) => {
              // B站视频ID：优先使用bvid，如果没有则使用aid（需要转换为BV号）
              const bvid = item.bvid || item.short_link_v2?.match(/BV\w+/)?.[0] || ''
              const aid = item.aid || ''
              
              // 生成视频URL
              let videoUrl = ''
              if (bvid) {
                videoUrl = `https://www.bilibili.com/video/${bvid}`
              } else if (aid) {
                // 如果有aid但没有bvid，尝试使用short_link_v2
                videoUrl = item.short_link_v2 || `https://www.bilibili.com/video/av${aid}`
              } else if (item.url) {
                videoUrl = item.url
              }
              
              const title = item.title || item.name || ''
              
              return {
                title,
                url: videoUrl,
                mobileUrl: videoUrl ? videoUrl.replace('www.bilibili.com', 'm.bilibili.com') : '',
                rank: index + 1,
              }
            }).filter((item: NewsItem) => item.title && item.url)

            if (items.length > 0) {
              console.log(`[Bilibili] API成功获取 ${items.length} 条数据`)
              return {
                success: true,
                platformId: this.platformId,
                data: items,
              }
            } else {
              console.warn(`[Bilibili] API端点 ${endpoint.url} 返回了数据，但无法解析出有效项。数据结构:`, JSON.stringify(data).substring(0, 500))
            }
          }
        } catch (endpointError: any) {
          const errorMsg = endpointError?.message || String(endpointError)
          console.error(`[Bilibili] API端点 ${endpoint.url} 失败:`, errorMsg)
          console.error(`[Bilibili] 错误详情:`, endpointError)
          continue
        }
      }

      // 如果所有端点都失败，返回详细错误
      const errorMsg = '所有API端点都失败或返回空数据。可能原因：1) API需要认证 2) 反爬虫机制 3) 数据结构已变更'
      console.error(`[Bilibili] ${errorMsg}`)
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
      console.error(`[Bilibili] API解析失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索B站内容
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []
      
      for (const keyword of keywords) {
        try {
          // B站搜索 API
          const searchUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20`
          
          const data = await fetchJSON(searchUrl, {
            referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
            origin: 'https://search.bilibili.com',
            timeout: 15000,
            proxyFallback: true,
          })
          
          const items: NewsItem[] = (data.data?.result || [])
            .slice(0, Math.ceil(limit / keywords.length))
            .map((item: any, index: number) => ({
              title: item.title || item.name || '',
              url: `https://www.bilibili.com/video/${item.bvid || item.aid}`,
              mobileUrl: `https://m.bilibili.com/video/${item.bvid || item.aid}`,
              rank: results.length + index + 1,
            }))
            .filter((item: NewsItem) => item.title)

          results.push(...items)
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[Bilibili] 搜索关键词 "${keyword}" 错误:`, error)
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
      console.error(`[Bilibili] 搜索失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }
}

