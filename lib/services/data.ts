import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export class DataService {
  private prisma: PrismaClient

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance || prisma
  }

  /**
   * 获取新闻项详情
   */
  static async getNewsItemById(id: string) {
    const newsItem = await prisma.newsItem.findUnique({
      where: { id },
      include: {
        platform: true,
        matches: {
          include: {
            keywordGroup: true,
          },
        },
      },
    })

    if (!newsItem) {
      return null
    }

    return {
      id: newsItem.id,
      title: newsItem.title,
      url: newsItem.url,
      mobileUrl: newsItem.mobileUrl,
      rank: newsItem.rank,
      crawledAt: newsItem.crawledAt,
      platformName: newsItem.platform.name,
      platformId: newsItem.platformId,
      matchWords: newsItem.matches.map((m) => m.keywordGroup.name || '未命名'),
      matches: newsItem.matches.map((m) => ({
        keywordGroup: m.keywordGroup.name,
        weight: m.weight,
      })),
      description: null,
      originalContent: null,
    }
  }

  /**
   * 获取最新新闻
   */
  async getLatestNews(options?: {
    platforms?: string[]
    limit?: number
    includeUrl?: boolean
  }): Promise<any[]> {
    const { platforms, limit = 50, includeUrl = false } = options || {}

    const where: any = {}

    if (platforms && platforms.length > 0) {
      where.platformId = { in: platforms }
    }

    const newsItems = await this.prisma.newsItem.findMany({
      where,
      include: {
        platform: true,
        matches: {
          include: {
            keywordGroup: true,
          },
        },
      },
      orderBy: { crawledAt: 'desc' },
      take: limit,
    })

    return newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      ...(includeUrl && { url: item.url, mobileUrl: item.mobileUrl }),
      platform: item.platform.name,
      platformId: item.platformId,
      rank: item.rank,
      crawledAt: item.crawledAt,
      matches: item.matches.map((match) => ({
        keywordGroup: match.keywordGroup.name,
        weight: match.weight,
      })),
    }))
  }

  /**
   * 按日期查询新闻
   */
  async getNewsByDate(
    date: Date,
    options?: {
      platforms?: string[]
      limit?: number
    }
  ): Promise<any[]> {
    const { platforms, limit = 50 } = options || {}

    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const where: any = {
      crawledAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    }

    if (platforms && platforms.length > 0) {
      where.platformId = { in: platforms }
    }

    const newsItems = await this.prisma.newsItem.findMany({
      where,
      include: {
        platform: true,
        matches: {
          include: {
            keywordGroup: true,
          },
        },
      },
      orderBy: { crawledAt: 'desc' },
      take: limit,
    })

    return newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      mobileUrl: item.mobileUrl,
      platform: item.platform.name,
      platformId: item.platformId,
      rank: item.rank,
      crawledAt: item.crawledAt,
      matches: item.matches.map((match) => ({
        keywordGroup: match.keywordGroup.name,
        weight: match.weight,
      })),
    }))
  }

  /**
   * 查询匹配的新闻
   */
  async getMatchedNews(options?: {
    keywordGroupId?: string
    minWeight?: number
    dateRange?: { start: Date; end: Date }
    limit?: number
  }): Promise<any[]> {
    const {
      keywordGroupId,
      minWeight,
      dateRange,
      limit = 50,
    } = options || {}

    const where: any = {}

    if (keywordGroupId) {
      where.keywordGroupId = keywordGroupId
    }

    if (minWeight !== undefined) {
      where.weight = { gte: minWeight }
    }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }

    const matches = await this.prisma.newsMatch.findMany({
      where,
      include: {
        newsItem: {
          include: {
            platform: true,
          },
        },
        keywordGroup: true,
      },
      orderBy: { weight: 'desc' },
      take: limit,
    })

    return matches.map((match) => ({
      id: match.id,
      newsItem: {
        id: match.newsItem.id,
        title: match.newsItem.title,
        url: match.newsItem.url,
        mobileUrl: match.newsItem.mobileUrl,
        platform: match.newsItem.platform.name,
        rank: match.newsItem.rank,
        crawledAt: match.newsItem.crawledAt,
      },
      keywordGroup: {
        id: match.keywordGroup.id,
        name: match.keywordGroup.name,
      },
      weight: match.weight,
      matchCount: match.matchCount,
      firstMatchedAt: match.firstMatchedAt,
      lastMatchedAt: match.lastMatchedAt,
    }))
  }

  /**
   * 获取统计数据
   */
  async getStatistics(options?: {
    dateRange?: { start: Date; end: Date }
    keywordGroupId?: string
  }): Promise<any> {
    const { dateRange, keywordGroupId } = options || {}

    const newsWhere: any = {}
    const matchWhere: any = {}

    if (dateRange) {
      newsWhere.crawledAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
      matchWhere.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }

    if (keywordGroupId) {
      matchWhere.keywordGroupId = keywordGroupId
    }

    const [totalNews, matchedNews, avgWeightResult, platformStats] =
      await Promise.all([
        this.prisma.newsItem.count({ where: newsWhere }),
        this.prisma.newsMatch.count({ where: matchWhere }),
        this.prisma.newsMatch.aggregate({
          where: matchWhere,
          _avg: { weight: true },
        }),
        this.prisma.newsItem.groupBy({
          by: ['platformId'],
          where: newsWhere,
          _count: true,
        }),
      ])

    const matchRate = totalNews > 0 ? matchedNews / totalNews : 0

    const platformStatsWithNames = await Promise.all(
      platformStats.map(async (stat) => {
        const platform = await this.prisma.platform.findUnique({
          where: { platformId: stat.platformId },
        })
        return {
          platformId: stat.platformId,
          platformName: platform?.name || stat.platformId,
          count: stat._count,
        }
      })
    )

    return {
      totalNews,
      matchedNews,
      matchRate,
      avgWeight: avgWeightResult._avg.weight || 0,
      platformStats: platformStatsWithNames,
    }
  }
}
