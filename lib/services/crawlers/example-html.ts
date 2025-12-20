/**
 * HTML解析爬虫示例
 * 展示如何使用Cheerio解析HTML页面
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'
import { HTMLParser } from '@/lib/utils/html-parser'

export class ExampleHTMLCrawler implements PlatformCrawler {
  platformId = 'example-html'

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
   * 爬取热点列表（HTML解析示例）
   */
  private async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    try {
      // 1. 获取HTML
      const url = 'https://example.com/news' // 替换为实际URL
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }).then(r => r.text())

      // 2. 解析HTML
      const $ = HTMLParser.parse(html)

      // 3. 提取数据（根据实际HTML结构调整选择器）
      const items: NewsItem[] = []

      // 方法1：使用通用提取方法
      const newsItems = HTMLParser.extractNewsList($, {
        itemSelector: '.news-item',      // 新闻项选择器
        titleSelector: '.title',         // 标题选择器
        urlSelector: 'a',                // URL选择器（可选）
        baseUrl: url,                     // 基础URL（用于转换相对URL）
      })

      // 方法2：手动提取（更灵活）
      $('.news-item').each((i, el) => {
        if (i >= limit) return false // 停止遍历

        const $el = $(el)
        
        // 使用备选选择器提高稳定性
        const title = HTMLParser.extractTextWithFallback($el, [
          '.title',
          '.news-title',
          'h3',
          '[data-title]',
        ])

        // 提取URL
        let url = $el.find('a').attr('href') || ''
        if (url) {
          url = HTMLParser.resolveUrl(url, url)
        }

        // 提取其他信息
        const time = $el.find('.time').text().trim()
        const author = $el.find('.author').text().trim()

        if (title && url) {
          items.push({
            title,
            url,
            rank: i + 1,
          })
        }
      })

      return {
        success: items.length > 0,
        platformId: this.platformId,
        data: items.slice(0, limit),
      }
    } catch (error) {
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
        if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = `网络请求失败: ${error.message}`
        }
      }
      console.error(`[ExampleHTML] 爬取失败:`, errorMessage, error)
      return {
        success: false,
        platformId: this.platformId,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据关键词搜索（HTML解析示例）
   */
  private async searchByKeywords(keywords: string[], limit: number = 10): Promise<CrawlResult> {
    try {
      const results: NewsItem[] = []

      for (const keyword of keywords) {
        try {
          // 构建搜索URL
          const searchUrl = `https://example.com/search?q=${encodeURIComponent(keyword)}`
          
          // 获取HTML
          const html = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
          }).then(r => r.text())

          // 解析HTML
          const $ = HTMLParser.parse(html)

          // 提取搜索结果
          $('.search-result-item').each((i, el) => {
            if (results.length >= limit) return false

            const $el = $(el)
            const title = $el.find('.result-title').text().trim()
            const url = $el.find('a').attr('href') || ''
            const snippet = $el.find('.result-snippet').text().trim()

            if (title && url) {
              results.push({
                title,
                url: HTMLParser.resolveUrl(searchUrl, url),
                rank: results.length + 1,
              })
            }
          })

          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`[ExampleHTML] 搜索关键词 "${keyword}" 错误:`, error)
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
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

