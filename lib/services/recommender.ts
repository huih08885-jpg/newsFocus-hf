import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type UserActionType = 'view' | 'click' | 'collect' | 'share'

export interface RecommendationOptions {
  limit?: number // 推荐数量，默认10
  minScore?: number // 最低推荐分数，默认0.1
  excludeViewed?: boolean // 是否排除已查看的新闻，默认true
}

export interface RecommendedNews {
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
  score: number // 推荐分数
  reason: string // 推荐理由
}

/**
 * 推荐服务类
 * 基于用户行为和历史数据，推荐相关新闻
 */
export class RecommenderService {
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * 记录用户行为
   */
  async recordUserAction(
    userId: string,
    newsItemId: string,
    action: UserActionType
  ): Promise<void> {
    try {
      await this.prisma.userAction.create({
        data: {
          userId,
          newsItemId,
          action,
        },
      })
    } catch (error) {
      console.error('Error recording user action:', error)
      // 忽略重复记录错误
    }
  }

  /**
   * 获取用户推荐新闻
   */
  async getRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendedNews[]> {
    const {
      limit = 10,
      minScore = 0.1,
      excludeViewed = true,
    } = options

    try {
      // 1. 获取用户行为历史（最近30天）
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const userActions = await this.prisma.userAction.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        include: {
          newsItem: {
            include: {
              platform: true,
              matches: {
                include: {
                  keywordGroup: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100, // 最多分析最近100条行为
      })

      // 如果用户没有行为历史，返回热门新闻
      if (userActions.length === 0) {
        return this.getPopularNews(limit)
      }

      // 2. 分析用户偏好
      const userPreferences = this.analyzeUserPreferences(userActions)

      // 3. 获取已查看的新闻ID（用于排除）
      const viewedNewsIds = excludeViewed
        ? new Set(
            userActions
              .filter((a) => a.action === 'view' || a.action === 'click')
              .map((a) => a.newsItemId)
          )
        : new Set<string>()

      // 4. 获取候选新闻（最近7天）
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const candidateNews = await this.prisma.newsItem.findMany({
        where: {
          crawledAt: {
            gte: sevenDaysAgo,
          },
          ...(excludeViewed && viewedNewsIds.size > 0
            ? {
                id: {
                  notIn: Array.from(viewedNewsIds),
                },
              }
            : {}),
        },
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
        orderBy: {
          crawledAt: 'desc',
        },
        take: 200, // 候选池大小
      })

      // 5. 计算推荐分数
      const scoredNews = candidateNews
        .map((news) => {
          const score = this.calculateRecommendationScore(
            news,
            userPreferences,
            userActions
          )
          return {
            news,
            score,
          }
        })
        .filter((item) => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      // 6. 生成推荐理由
      return scoredNews.map((item) => ({
        id: item.news.id,
        title: item.news.title,
        url: item.news.url,
        mobileUrl: item.news.mobileUrl,
        platformId: item.news.platformId,
        platformName: item.news.platform.name,
        rank: item.news.rank,
        crawledAt: item.news.crawledAt,
        sentiment: item.news.sentiment,
        sentimentScore: item.news.sentimentScore,
        score: item.score,
        reason: this.generateRecommendationReason(
          item.news,
          item.score,
          userPreferences
        ),
      }))
    } catch (error) {
      console.error('Error getting recommendations:', error)
      // 出错时返回热门新闻
      return this.getPopularNews(limit)
    }
  }

  /**
   * 分析用户偏好
   */
  private analyzeUserPreferences(
    userActions: Array<{
      action: string
      newsItem: {
        platformId: string
        matches: Array<{
          keywordGroup: {
            name: string | null
            words: string[]
          }
        }>
      }
    }>
  ): {
    platforms: Map<string, number> // 平台偏好分数
    keywords: Map<string, number> // 关键词偏好分数
  } {
    const platforms = new Map<string, number>()
    const keywords = new Map<string, number>()

    // 不同行为的权重
    const actionWeights: Record<string, number> = {
      view: 1,
      click: 2,
      collect: 5,
      share: 3,
    }

    userActions.forEach((action) => {
      const weight = actionWeights[action.action] || 1
      const platformId = action.newsItem.platformId

      // 累加平台偏好
      platforms.set(
        platformId,
        (platforms.get(platformId) || 0) + weight
      )

      // 累加关键词偏好
      action.newsItem.matches.forEach((match) => {
        match.keywordGroup.words.forEach((keyword) => {
          keywords.set(
            keyword,
            (keywords.get(keyword) || 0) + weight
          )
        })
      })
    })

    return { platforms, keywords }
  }

  /**
   * 计算推荐分数
   */
  private calculateRecommendationScore(
    news: {
      platformId: string
      crawledAt: Date
      rank: number
      matches: Array<{
        keywordGroup: {
          words: string[]
        }
        weight: number
      }>
    },
    userPreferences: {
      platforms: Map<string, number>
      keywords: Map<string, number>
    },
    userActions: Array<{
      newsItemId: string
    }>
  ): number {
    let score = 0

    // 1. 平台偏好分数（0-0.3）
    const platformScore = userPreferences.platforms.get(news.platformId) || 0
    const maxPlatformScore = Math.max(
      ...Array.from(userPreferences.platforms.values()),
      1
    )
    score += (platformScore / maxPlatformScore) * 0.3

    // 2. 关键词匹配分数（0-0.4）
    let keywordScore = 0
    news.matches.forEach((match) => {
      match.keywordGroup.words.forEach((keyword) => {
        const keywordWeight = userPreferences.keywords.get(keyword) || 0
        keywordScore += keywordWeight
      })
    })
    const maxKeywordScore = Math.max(
      ...Array.from(userPreferences.keywords.values()),
      1
    )
    score += (keywordScore / maxKeywordScore) * 0.4

    // 3. 新闻权重分数（0-0.2）
    const maxMatchWeight = news.matches[0]?.weight || 0
    score += Math.min(maxMatchWeight / 100000, 1) * 0.2

    // 4. 时间衰减分数（0-0.1）
    const hoursSinceCrawl =
      (Date.now() - news.crawledAt.getTime()) / (1000 * 60 * 60)
    const timeScore = Math.max(0, 1 - hoursSinceCrawl / 168) // 7天衰减
    score += timeScore * 0.1

    return score
  }

  /**
   * 生成推荐理由
   */
  private generateRecommendationReason(
    news: {
      platformId: string
      matches: Array<{
        keywordGroup: {
          name: string | null
        }
      }>
    },
    score: number,
    userPreferences: {
      platforms: Map<string, number>
      keywords: Map<string, number>
    }
  ): string {
    const reasons: string[] = []

    // 平台偏好
    const platformScore = userPreferences.platforms.get(news.platformId) || 0
    if (platformScore > 0) {
      reasons.push('您常关注此平台')
    }

    // 关键词匹配
    if (news.matches.length > 0) {
      const keywordGroupName = news.matches[0].keywordGroup.name
      if (keywordGroupName) {
        reasons.push(`匹配关键词组"${keywordGroupName}"`)
      } else {
        reasons.push('匹配您的关注关键词')
      }
    }

    // 高权重
    if (score > 0.5) {
      reasons.push('热门内容')
    }

    return reasons.length > 0 ? reasons.join('，') : '为您推荐'
  }

  /**
   * 获取热门新闻（当用户没有行为历史时）
   */
  private async getPopularNews(limit: number): Promise<RecommendedNews[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const popularNews = await this.prisma.newsItem.findMany({
      where: {
        crawledAt: {
          gte: sevenDaysAgo,
        },
      },
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
      orderBy: {
        crawledAt: 'desc',
      },
      take: limit * 2, // 获取更多候选
    })

    // 按权重排序
    const sortedNews = popularNews
      .map((news) => ({
        news,
        weight: news.matches[0]?.weight || 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit)

    return sortedNews.map((item) => ({
      id: item.news.id,
      title: item.news.title,
      url: item.news.url,
      mobileUrl: item.news.mobileUrl,
      platformId: item.news.platformId,
      platformName: item.news.platform.name,
      rank: item.news.rank,
      crawledAt: item.news.crawledAt,
      sentiment: item.news.sentiment,
      sentimentScore: item.news.sentimentScore,
      score: 0.5, // 默认分数
      reason: '热门推荐',
    }))
  }

  /**
   * 获取相关新闻（基于内容相似度）
   */
  async getRelatedNews(
    newsItemId: string,
    limit: number = 5
  ): Promise<RecommendedNews[]> {
    try {
      const newsItem = await this.prisma.newsItem.findUnique({
        where: { id: newsItemId },
        include: {
          matches: {
            include: {
              keywordGroup: true,
            },
          },
        },
      })

      if (!newsItem) {
        return []
      }

      // 获取匹配的关键词
      const keywords = new Set<string>()
      newsItem.matches.forEach((match) => {
        match.keywordGroup.words.forEach((keyword) => {
          keywords.add(keyword)
        })
      })

      if (keywords.size === 0) {
        return []
      }

      // 查找包含相同关键词的新闻
      const relatedNews = await this.prisma.newsItem.findMany({
        where: {
          id: {
            not: newsItemId,
          },
          crawledAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          matches: {
            some: {
              keywordGroup: {
                words: {
                  hasSome: Array.from(keywords),
                },
              },
            },
          },
        },
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
        orderBy: {
          crawledAt: 'desc',
        },
        take: limit,
      })

      return relatedNews.map((news) => ({
        id: news.id,
        title: news.title,
        url: news.url,
        mobileUrl: news.mobileUrl,
        platformId: news.platformId,
        platformName: news.platform.name,
        rank: news.rank,
        crawledAt: news.crawledAt,
        sentiment: news.sentiment,
        sentimentScore: news.sentimentScore,
        score: 0.6, // 相关新闻默认分数
        reason: '相关内容',
      }))
    } catch (error) {
      console.error('Error getting related news:', error)
      return []
    }
  }
}

