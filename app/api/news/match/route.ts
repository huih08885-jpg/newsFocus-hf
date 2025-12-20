import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MatcherService } from '@/lib/services/matcher'
import { CalculatorService } from '@/lib/services/calculator'

/**
 * 手动触发关键词匹配
 * POST /api/news/match
 * 
 * 可选参数：
 * - all: 匹配所有新闻（默认：只匹配最近1小时的新闻）
 * - dateFrom: 开始日期（ISO格式）
 * - dateTo: 结束日期（ISO格式）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { all, dateFrom, dateTo } = body

    // 业务逻辑验证：检查是否有启用的关键词组
    const enabledGroups = await prisma.keywordGroup.findMany({
      where: { enabled: true },
    })

    if (enabledGroups.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_KEYWORD_GROUPS',
            message: '没有启用的关键词组，请先配置关键词组',
          },
        },
        { status: 400 }
      )
    }

    const matcher = new MatcherService(prisma)
    const calculator = new CalculatorService()

    // 构建查询条件
    const where: any = {}
    if (!all) {
      if (dateFrom || dateTo) {
        where.crawledAt = {}
        if (dateFrom) where.crawledAt.gte = new Date(dateFrom)
        if (dateTo) where.crawledAt.lte = new Date(dateTo)
      } else {
        // 默认：最近1小时
        where.crawledAt = {
          gte: new Date(Date.now() - 3600000),
        }
      }
    }

    // 获取需要匹配的新闻
    const newsItems = await prisma.newsItem.findMany({
      where,
      include: {
        platform: true,
      },
      orderBy: {
        crawledAt: 'desc',
      },
    })

    console.log(`[关键词匹配] 开始对 ${newsItems.length} 条新闻进行匹配...`)

    if (newsItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalNews: 0,
          matchedCount: 0,
          message: '没有找到需要匹配的新闻',
        },
      })
    }

    // 匹配关键词
    const matches = await matcher.matchNewsItems(
      newsItems.map((n) => ({ id: n.id, title: n.title }))
    )

    let matchedCount = 0
    let createdCount = 0
    let updatedCount = 0

    // 处理匹配结果
    for (const [newsId, keywordGroups] of matches.entries()) {
      const newsItem = newsItems.find((n) => n.id === newsId)
      if (!newsItem) continue

      matchedCount++

      // 获取新闻的现有出现记录
      const appearances = await prisma.newsAppearance.findMany({
        where: { newsItemId: newsId },
      })

      for (const keywordGroup of keywordGroups) {
        // 计算权重
        const appearanceData = appearances.map((a) => ({
          rank: a.rank,
          appearedAt: a.appearedAt,
        }))
        
        const weight = calculator.calculateWeight({
          ranks: appearanceData.map((a) => a.rank).concat([newsItem.rank]),
          matchCount: 1,
          appearances: appearanceData.concat([
            {
              rank: newsItem.rank,
              appearedAt: newsItem.crawledAt,
            },
          ]),
        })

        // 检查是否已存在匹配记录
        const existingMatch = await prisma.newsMatch.findUnique({
          where: {
            newsItemId_keywordGroupId: {
              newsItemId: newsId,
              keywordGroupId: keywordGroup.id,
            },
          },
        })

        if (existingMatch) {
          // 更新现有匹配记录
          await prisma.newsMatch.update({
            where: { id: existingMatch.id },
            data: {
              weight,
              matchCount: { increment: 1 },
              lastMatchedAt: new Date(),
            },
          })
          updatedCount++
        } else {
          // 创建新匹配记录
          const matchRecord = await prisma.newsMatch.create({
            data: {
              newsItemId: newsId,
              keywordGroupId: keywordGroup.id,
              weight,
              matchCount: 1,
              firstMatchedAt: new Date(),
              lastMatchedAt: new Date(),
            },
          })

          // 创建出现记录（如果不存在）
          const existingAppearance = await prisma.newsAppearance.findFirst({
            where: {
              newsItemId: newsId,
              matchId: matchRecord.id,
              rank: newsItem.rank,
            },
          })

          if (!existingAppearance) {
            await prisma.newsAppearance.create({
              data: {
                newsItemId: newsId,
                matchId: matchRecord.id,
                rank: newsItem.rank,
                appearedAt: newsItem.crawledAt,
              },
            })
          }

          createdCount++
        }
      }
    }

    console.log(`[关键词匹配] 完成: 匹配到 ${matchedCount} 条新闻，创建 ${createdCount} 条记录，更新 ${updatedCount} 条记录`)

    return NextResponse.json({
      success: true,
      data: {
        totalNews: newsItems.length,
        matchedCount,
        createdCount,
        updatedCount,
        message: `成功匹配 ${matchedCount} 条新闻`,
      },
    })
  } catch (error) {
    console.error('Error matching keywords:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MATCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

