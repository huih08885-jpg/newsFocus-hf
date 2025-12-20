import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export interface SearchOptions {
  query: string // 搜索关键词
  platforms?: string[] // 平台筛选
  dateFrom?: Date // 开始日期
  dateTo?: Date // 结束日期
  sentiment?: 'positive' | 'negative' | 'neutral' // 情感筛选
  keywordGroupId?: string // 关键词组筛选
  minWeight?: number // 最小权重
  limit?: number // 返回数量，默认20
  offset?: number // 偏移量，默认0
  sortBy?: 'relevance' | 'crawledAt' | 'weight' | 'rank' // 排序方式
  sortOrder?: 'asc' | 'desc' // 排序方向
}

export interface SearchResult {
  id: string
  title: string
  url: string | null
  mobileUrl: string | null
  platformId: string
  platformName: string
  rank: number
  crawledAt: Date
  sentiment: string | null
  sentimentScore: number | null
  keywordGroup: string | null
  weight: number
  relevanceScore: number // 相关性分数
  highlights: string[] // 高亮片段
}

/**
 * 搜索服务类
 * 提供全文搜索功能
 */
export class SearchService {
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * 执行搜索
   */
  async search(options: SearchOptions): Promise<{
    items: SearchResult[]
    total: number
    limit: number
    offset: number
  }> {
    const {
      query,
      platforms,
      dateFrom,
      dateTo,
      sentiment,
      keywordGroupId,
      minWeight,
      limit = 20,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'desc',
    } = options

    if (!query || query.trim().length === 0) {
      return {
        items: [],
        total: 0,
        limit,
        offset,
      }
    }

    try {
      // 构建 where 条件
      const where: any = {
        title: {
          contains: query.trim(),
          mode: 'insensitive', // 不区分大小写
        },
      }

      // 平台筛选
      if (platforms && platforms.length > 0) {
        where.platformId = { in: platforms }
      }

      // 日期筛选
      if (dateFrom || dateTo) {
        where.crawledAt = {}
        if (dateFrom) where.crawledAt.gte = dateFrom
        if (dateTo) where.crawledAt.lte = dateTo
      }

      // 情感筛选
      if (sentiment) {
        where.sentiment = sentiment
      }

      // 如果指定了关键词组或最小权重，需要通过matches查询
      let items: any[] = []
      let total = 0

      if (keywordGroupId || minWeight) {
        // 先查询匹配记录
        const matchWhere: any = {
          newsItem: where,
        }
        if (keywordGroupId) matchWhere.keywordGroupId = keywordGroupId
        if (minWeight) matchWhere.weight = { gte: minWeight }

        const matches = await this.prisma.newsMatch.findMany({
          where: matchWhere,
          include: {
            newsItem: {
              include: {
                platform: true,
              },
            },
            keywordGroup: true,
          },
        })

        // 转换并计算相关性
        items = matches
          .map((match) => {
            const newsItem = match.newsItem
            const relevanceScore = this.calculateRelevanceScore(
              newsItem.title,
              query
            )
            const highlights = this.extractHighlights(newsItem.title, query)

            return {
              id: newsItem.id,
              title: newsItem.title,
              url: newsItem.url,
              mobileUrl: newsItem.mobileUrl,
              platformId: newsItem.platformId,
              platformName: newsItem.platform.name,
              rank: newsItem.rank,
              crawledAt: newsItem.crawledAt,
              sentiment: newsItem.sentiment,
              sentimentScore: newsItem.sentimentScore,
              keywordGroup: match.keywordGroup.name,
              weight: match.weight,
              relevanceScore,
              highlights,
            }
          })
          .filter((item) => item.relevanceScore > 0)

        total = items.length

        // 排序
        items = this.sortResults(items, sortBy, sortOrder)

        // 分页
        items = items.slice(offset, offset + limit)
      } else {
        // 直接查询新闻
        const newsItems = await this.prisma.newsItem.findMany({
          where,
          include: {
            platform: true,
            matches: {
              include: {
                keywordGroup: true,
              },
              orderBy: {
                weight: 'desc',
              },
              take: 1,
            },
          },
          take: limit * 3, // 多取一些用于排序
          skip: offset,
        })

        // 计算相关性并转换
        items = newsItems
          .map((item) => {
            const relevanceScore = this.calculateRelevanceScore(
              item.title,
              query
            )
            const highlights = this.extractHighlights(item.title, query)

            return {
              id: item.id,
              title: item.title,
              url: item.url,
              mobileUrl: item.mobileUrl,
              platformId: item.platformId,
              platformName: item.platform.name,
              rank: item.rank,
              crawledAt: item.crawledAt,
              sentiment: item.sentiment,
              sentimentScore: item.sentimentScore,
              keywordGroup: item.matches[0]?.keywordGroup.name || null,
              weight: item.matches[0]?.weight || 0,
              relevanceScore,
              highlights,
            }
          })
          .filter((item) => item.relevanceScore > 0)

        total = await this.prisma.newsItem.count({ where })

        // 排序
        items = this.sortResults(items, sortBy, sortOrder)

        // 分页
        items = items.slice(0, limit)
      }

      return {
        items,
        total,
        limit,
        offset,
      }
    } catch (error) {
      console.error('Error searching:', error)
      throw error
    }
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevanceScore(title: string, query: string): number {
    const lowerTitle = title.toLowerCase()
    const lowerQuery = query.toLowerCase().trim()
    const queryWords = lowerQuery.split(/\s+/)

    let score = 0

    // 完全匹配（最高分）
    if (lowerTitle.includes(lowerQuery)) {
      score += 100
    }

    // 单词匹配
    queryWords.forEach((word) => {
      if (word.length < 2) return // 忽略单字符

      if (lowerTitle.includes(word)) {
        score += 10

        // 如果单词在标题开头，额外加分
        if (lowerTitle.startsWith(word)) {
          score += 5
        }
      }
    })

    // 匹配位置权重（越靠前分数越高）
    const index = lowerTitle.indexOf(lowerQuery)
    if (index >= 0) {
      const positionWeight = Math.max(0, 1 - index / title.length) * 20
      score += positionWeight
    }

    return score
  }

  /**
   * 提取高亮片段
   */
  private extractHighlights(text: string, query: string): string[] {
    const highlights: string[] = []
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase().trim()
    const queryWords = lowerQuery.split(/\s+/)

    // 查找包含查询词的片段
    queryWords.forEach((word) => {
      if (word.length < 2) return

      const index = lowerText.indexOf(word)
      if (index >= 0) {
        const start = Math.max(0, index - 10)
        const end = Math.min(text.length, index + word.length + 10)
        const snippet = text.substring(start, end)
        highlights.push(snippet)
      }
    })

    // 如果没有找到片段，返回整个标题的前50个字符
    if (highlights.length === 0) {
      highlights.push(text.substring(0, Math.min(50, text.length)))
    }

    return highlights.slice(0, 3) // 最多返回3个片段
  }

  /**
   * 排序结果
   */
  private sortResults(
    items: SearchResult[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): SearchResult[] {
    return [...items].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore
          break
        case 'crawledAt':
          comparison =
            a.crawledAt.getTime() - b.crawledAt.getTime()
          break
        case 'weight':
          comparison = a.weight - b.weight
          break
        case 'rank':
          comparison = a.rank - b.rank
          break
        default:
          comparison = a.relevanceScore - b.relevanceScore
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })
  }

  /**
   * 获取搜索建议（自动完成）
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    try {
      const suggestions = await this.prisma.newsItem.findMany({
        where: {
          title: {
            contains: query.trim(),
            mode: 'insensitive',
          },
        },
        select: {
          title: true,
        },
        distinct: ['title'],
        take: limit,
        orderBy: {
          crawledAt: 'desc',
        },
      })

      return suggestions.map((s) => s.title).slice(0, limit)
    } catch (error) {
      console.error('Error getting suggestions:', error)
      return []
    }
  }

  /**
   * 获取热门搜索词
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // 这里可以基于用户搜索历史统计，暂时返回空数组
    // 未来可以实现搜索词统计功能
    return []
  }
}

