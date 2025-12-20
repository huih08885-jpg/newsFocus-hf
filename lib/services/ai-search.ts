/**
 * AI 搜索服务
 * 结合搜索引擎和 DeepSeek AI，提供智能搜索功能
 */

import { SearchOrchestrator, type UnifiedSearchResult } from './search-orchestrator'
import { deepSeekAI } from './deepseek-ai'

export interface AISearchRequest {
  keywords: string[]
  startDate?: string // ISO 日期字符串，如 "2024-01-01"
  endDate?: string // ISO 日期字符串，如 "2024-12-31"
  searchEngines?: string[] // 搜索引擎列表，默认 ['bing']（不使用百度）
  maxResults?: number // 最大返回结果数，默认 20
  includeAnalysis?: boolean // 是否包含 AI 分析总结，默认 true
}

export interface AISearchResult {
  items: Array<{
    url: string
    snippet?: string | null
    publishedAt?: string | null
  }>
  totalFound: number // 搜索引擎找到的总数
  totalFiltered: number // AI 筛选后的数量
  timeRange?: {
    start: string
    end: string
  }
  tokenUsage?: {
    total: number // 总 token 数
    prompt: number // 输入 token 数
    completion: number // 输出 token 数
  }
}

export class AISearchService {
  private searchOrchestrator: SearchOrchestrator

  constructor() {
    this.searchOrchestrator = new SearchOrchestrator()
  }

  /**
   * 执行 AI 搜索
   */
  async search(request: AISearchRequest): Promise<AISearchResult> {
    const {
      keywords,
      startDate,
      endDate,
      searchEngines = ['bing'], // 不使用百度，只使用Bing
      maxResults = 20,
      includeAnalysis = true,
    } = request

    // 1. 先用搜索引擎获取原始结果
    console.log('[AISearch] 开始搜索引擎查询...')
    const searchResults = await this.searchOrchestrator.unifiedSearch({
      keywords,
      searchEngines,
      limitPerPlatform: Math.max(10, Math.ceil(maxResults / searchEngines.length)),
      page: 1,
      pageSize: maxResults * 2, // 多获取一些，供 AI 筛选
    })

    console.log(`[AISearch] 搜索引擎找到 ${searchResults.results.length} 条结果`)

    // 2. 准备给 AI 的数据
    const searchData = this.formatSearchResultsForAI(searchResults.results, {
      startDate,
      endDate,
      keywords,
    })

    // 3. 使用 DeepSeek AI 进行智能筛选和分析
    if (includeAnalysis && searchData.items.length > 0) {
      console.log('[AISearch] 开始 AI 智能筛选和分析...')
      const aiResult = await this.analyzeWithAI(searchData, {
        keywords,
        startDate,
        endDate,
        maxResults,
      })

      return {
        items: aiResult.filteredItems.map(item => ({
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
        })),
        totalFound: searchResults.total,
        totalFiltered: aiResult.filteredItems.length,
        timeRange: startDate && endDate ? { start: startDate, end: endDate } : undefined,
        tokenUsage: aiResult.tokenUsage,
      }
    } else {
      // 如果没有 AI 分析，直接返回原始结果（简单时间过滤）
      const filtered = this.simpleTimeFilter(searchData.items, startDate, endDate)
      return {
        items: filtered.slice(0, maxResults).map(item => ({
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
        })),
        totalFound: searchResults.total,
        totalFiltered: filtered.length,
        timeRange: startDate && endDate ? { start: startDate, end: endDate } : undefined,
      }
    }
  }

  /**
   * 格式化搜索结果供 AI 分析（优化：只保留必要字段）
   */
  private formatSearchResultsForAI(
    results: UnifiedSearchResult[],
    context: {
      keywords: string[]
      startDate?: string
      endDate?: string
    }
  ): {
    items: Array<{
      index: number
      title: string
      url: string
      source: string
      snippet?: string | null
      publishedAt?: string | null
    }>
    context: {
      keywords: string[]
      startDate?: string
      endDate?: string
      totalCount: number
    }
  } {
    return {
      items: results.map((item, index) => ({
        index: index + 1,
        title: item.title || item.url || '无标题',
        url: item.url,
        source: item.source || '未知来源',
        snippet: item.snippet,
        publishedAt: item.publishedAt,
      })),
      context: {
        keywords: context.keywords,
        startDate: context.startDate,
        endDate: context.endDate,
        totalCount: results.length,
      },
    }
  }

  /**
   * 使用 AI 分析搜索结果
   */
  private async analyzeWithAI(
    searchData: {
      items: Array<{
        index: number
        title: string
        url: string
        source: string
        snippet?: string | null
        publishedAt?: string | null
      }>
      context: {
        keywords: string[]
        startDate?: string
        endDate?: string
        totalCount: number
      }
    },
    options: {
      keywords: string[]
      startDate?: string
      endDate?: string
      maxResults: number
    }
  ): Promise<{
    filteredItems: Array<{
      url: string
      snippet?: string | null
      publishedAt?: string | null
    }>
    tokenUsage?: AISearchResult['tokenUsage']
  }> {
    const prompt = this.buildAISearchPrompt(searchData, options)

    const aiResponse = await deepSeekAI.analyzeContent('trend', prompt, undefined)

    // 提取 token 使用量
    const tokenUsage = aiResponse.tokenDetails
      ? {
          total: aiResponse.tokenDetails.total,
          prompt: aiResponse.tokenDetails.prompt,
          completion: aiResponse.tokenDetails.completion,
        }
      : aiResponse.tokenUsage
      ? {
          total: aiResponse.tokenUsage,
          prompt: 0, // 如果没有详细信息，只显示总数
          completion: 0,
        }
      : undefined

    if (!aiResponse.success || !aiResponse.result) {
      console.warn('[AISearch] AI 分析失败，使用简单筛选')
      return {
        filteredItems: this.simpleTimeFilter(
          searchData.items.map((item) => ({
            url: item.url,
            snippet: item.snippet,
            publishedAt: item.publishedAt,
          })),
          options.startDate,
          options.endDate
        ).slice(0, options.maxResults),
        tokenUsage,
      }
    }

    // 解析 AI 返回的 JSON
    try {
      const aiContent = aiResponse.result.content
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || aiContent.match(/\{[\s\S]*\}/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      
      // 根据 AI 返回的索引，筛选出相关结果
      const selectedIndices = new Set(parsed.selectedIndices || [])
      const filteredItems = searchData.items
        .filter((item) => selectedIndices.has(item.index))
        .map((item) => ({
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
        }))
        .slice(0, options.maxResults)

      return {
        filteredItems,
        tokenUsage,
      }
    } catch (error) {
      console.error('[AISearch] 解析 AI 响应失败:', error)
      // 降级到简单筛选
      return {
        filteredItems: this.simpleTimeFilter(
          searchData.items.map((item) => ({
            url: item.url,
            snippet: item.snippet,
            publishedAt: item.publishedAt,
          })),
          options.startDate,
          options.endDate
        ).slice(0, options.maxResults),
        tokenUsage,
      }
    }
  }

  /**
   * 构建 AI 搜索 Prompt
   */
  private buildAISearchPrompt(
    searchData: {
      items: Array<{
        index: number
        url: string
        snippet?: string | null
        publishedAt?: string | null
      }>
      context: {
        keywords: string[]
        startDate?: string
        endDate?: string
        totalCount: number
      }
    },
    options: {
      keywords: string[]
      startDate?: string
      endDate?: string
      maxResults: number
    }
  ): string {
    const timeFilter = options.startDate && options.endDate
      ? `时间范围：${options.startDate} 至 ${options.endDate}`
      : '无特定时间限制'

    // 优化：只传递必要信息，减少token消耗
    const itemsText = searchData.items
      .map(
        (item) => `${item.index}. ${item.snippet || '无摘要'} | ${item.publishedAt || '未知'} | ${item.url}`
      )
      .join('\n')

    // 简化prompt，只保留筛选功能，减少token消耗
    return `筛选与"${options.keywords.join(' ')}"相关${timeFilter !== '无特定时间限制' ? `且时间在${timeFilter}` : ''}的新闻，最多${options.maxResults}条。

${itemsText}

返回JSON：{"selectedIndices":[1,3,5]}`
  }

  /**
   * 简单时间过滤（降级方案）
   */
  private simpleTimeFilter(
    items: Array<{
      url: string
      snippet?: string | null
      publishedAt?: string | null
    }>,
    startDate?: string,
    endDate?: string
  ): AISearchResult['items'] {
    if (!startDate && !endDate) {
      return items.map((item) => ({
        url: item.url,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
      }))
    }

    const start = startDate ? new Date(startDate).getTime() : 0
    const end = endDate ? new Date(endDate).getTime() : Date.now()

    return items
      .filter((item) => {
        if (!item.publishedAt) return true // 没有时间的保留

        // 尝试解析发布时间
        const publishedTime = this.parsePublishedTime(item.publishedAt)
        if (!publishedTime) return true // 无法解析的保留

        return publishedTime >= start && publishedTime <= end
      })
      .map((item) => ({
        url: item.url,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
      }))
  }

  /**
   * 解析发布时间字符串
   */
  private parsePublishedTime(timeStr: string): number | null {
    try {
      // 尝试直接解析 ISO 格式
      const date = new Date(timeStr)
      if (!isNaN(date.getTime())) {
        return date.getTime()
      }

      // 尝试解析相对时间（如 "2小时前"）
      const hourMatch = timeStr.match(/(\d+)小时前/)
      if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10)
        return Date.now() - hours * 60 * 60 * 1000
      }

      const dayMatch = timeStr.match(/(\d+)天前/)
      if (dayMatch) {
        const days = parseInt(dayMatch[1], 10)
        return Date.now() - days * 24 * 60 * 60 * 1000
      }

      // 尝试解析日期格式（如 "2024-01-01"）
      const dateMatch = timeStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10)
        const month = parseInt(dateMatch[2], 10) - 1
        const day = parseInt(dateMatch[3], 10)
        return new Date(year, month, day).getTime()
      }

      return null
    } catch {
      return null
    }
  }
}

export const aiSearchService = new AISearchService()

