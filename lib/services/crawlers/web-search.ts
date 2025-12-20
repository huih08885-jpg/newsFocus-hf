/**
 * 全网搜索爬虫
 * 使用搜索引擎API进行全网搜索，不局限于特定平台
 */

import { PlatformCrawler, CrawlResult, NewsItem, CrawlOptions } from './base'

export class WebSearchCrawler implements PlatformCrawler {
  platformId = 'web-search'

  async crawl(): Promise<CrawlResult> {
    return this.crawlWithOptions({ mode: 'hot' })
  }

  async crawlWithOptions(options?: CrawlOptions): Promise<CrawlResult> {
    const { keywords, mode = 'hot', limit = 20 } = options || {}

    // 全网搜索必须提供关键词
    if (mode === 'search' && keywords && keywords.length > 0) {
      return this.searchWeb(keywords, limit)
    }

    // 如果没有关键词，返回错误
    return {
      success: false,
      platformId: this.platformId,
      error: '全网搜索需要提供关键词',
    }
  }

  /**
   * 全网搜索
   * 使用多个搜索引擎API进行搜索
   */
  private async searchWeb(keywords: string[], limit: number = 20): Promise<CrawlResult> {
    const results: NewsItem[] = []
    const errors: string[] = []

    // 尝试多个搜索引擎
    const searchEngines = [
      { name: 'Google', search: this.searchGoogle.bind(this) },
      { name: 'Bing', search: this.searchBing.bind(this) },
      { name: 'Baidu', search: this.searchBaidu.bind(this) },
      { name: 'DuckDuckGo', search: this.searchDuckDuckGo.bind(this) },
    ]

    for (const keyword of keywords) {
      for (const engine of searchEngines) {
        try {
          const items = await engine.search(keyword, Math.ceil(limit / keywords.length))
          results.push(...items)
          
          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // 如果已经获取足够的结果，可以提前退出
          if (results.length >= limit) break
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`${engine.name}: ${errorMsg}`)
          console.warn(`[WebSearch] ${engine.name} 搜索失败:`, errorMsg)
        }
      }
      
      // 如果已经获取足够的结果，可以提前退出
      if (results.length >= limit) break
    }

    // 去重（基于标题）
    const uniqueResults = this.deduplicateByTitle(results)

    return {
      success: uniqueResults.length > 0,
      platformId: this.platformId,
      data: uniqueResults.slice(0, limit),
      error: errors.length > 0 && uniqueResults.length === 0 
        ? `所有搜索引擎都失败: ${errors.join('; ')}` 
        : undefined,
    }
  }

  /**
   * Google 搜索
   */
  private async searchGoogle(keyword: string, limit: number): Promise<NewsItem[]> {
    // 使用 Google Custom Search API
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

    if (!apiKey || !searchEngineId) {
      throw new Error('Google Search API 未配置')
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(keyword)}&num=${Math.min(limit, 10)}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    return (data.items || []).map((item: any, index: number) => ({
      title: item.title || '',
      url: item.link || '',
      mobileUrl: item.link || '',
      rank: index + 1,
    })).filter((item: NewsItem) => item.title)
  }

  /**
   * Bing 搜索
   */
  private async searchBing(keyword: string, limit: number): Promise<NewsItem[]> {
    const apiKey = process.env.BING_SEARCH_API_KEY

    if (!apiKey) {
      throw new Error('Bing Search API 未配置')
    }

    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(keyword)}&count=${Math.min(limit, 50)}&responseFilter=Webpages`
    
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    return (data.webPages?.value || []).map((item: any, index: number) => ({
      title: item.name || '',
      url: item.url || '',
      mobileUrl: item.url || '',
      rank: index + 1,
    })).filter((item: NewsItem) => item.title)
  }

  /**
   * 百度搜索（使用网页爬取，因为API需要认证）
   */
  private async searchBaidu(keyword: string, limit: number): Promise<NewsItem[]> {
    // 百度搜索API需要认证，这里提供一个基础实现
    // 实际使用时可能需要使用代理或API服务
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&rn=${limit}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    
    // 简单的HTML解析（实际应该使用更强大的解析库）
    // 这里返回空数组，需要实现HTML解析逻辑
    // 或者使用百度搜索API（需要申请）
    return []
  }

  /**
   * DuckDuckGo 搜索（不需要API Key）
   */
  private async searchDuckDuckGo(keyword: string, limit: number): Promise<NewsItem[]> {
    // DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(keyword)}&format=json&no_html=1&skip_disambig=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    // DuckDuckGo API返回格式不同，需要适配
    const items: NewsItem[] = []
    
    // RelatedTopics
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, limit).forEach((topic: any, index: number) => {
        if (topic.Text && topic.FirstURL) {
          items.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            mobileUrl: topic.FirstURL,
            rank: index + 1,
          })
        }
      })
    }

    return items
  }

  /**
   * 根据标题去重
   */
  private deduplicateByTitle(items: NewsItem[]): NewsItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const normalizedTitle = item.title.toLowerCase().trim()
      if (seen.has(normalizedTitle)) {
        return false
      }
      seen.add(normalizedTitle)
      return true
    })
  }
}

