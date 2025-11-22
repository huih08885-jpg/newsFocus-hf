import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
      ? new Date(searchParams.get('dateFrom')!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 默认7天前
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : new Date()
    const keywordGroupId = searchParams.get('keywordGroupId')
    const platforms = searchParams.get('platforms')?.split(',')

    // 查询总新闻数
    const totalNews = await prisma.newsItem.count({
      where: {
        crawledAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        ...(platforms && platforms.length > 0
          ? { platformId: { in: platforms } }
          : {}),
      },
    })

    // 查询匹配新闻数
    const matchedNews = await prisma.newsMatch.count({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        ...(keywordGroupId ? { keywordGroupId } : {}),
      },
    })

    // 计算匹配率
    const matchRate = totalNews > 0 ? matchedNews / totalNews : 0

    // 计算平均权重
    const avgWeightResult = await prisma.newsMatch.aggregate({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        ...(keywordGroupId ? { keywordGroupId } : {}),
      },
      _avg: {
        weight: true,
      },
    })

    // 平台统计
    const platformStats = await prisma.newsItem.groupBy({
      by: ['platformId'],
      where: {
        crawledAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _count: true,
    })

    const platformStatsWithNames = await Promise.all(
      platformStats.map(async (stat) => {
        const platform = await prisma.platform.findUnique({
          where: { platformId: stat.platformId },
        })
        return {
          platformId: stat.platformId,
          platformName: platform?.name || stat.platformId,
          count: stat._count,
        }
      })
    )

    // 关键词组统计
    const keywordGroupStats = await prisma.newsMatch.groupBy({
      by: ['keywordGroupId'],
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _count: true,
      _avg: {
        weight: true,
      },
    })

    const keywordGroupStatsWithNames = await Promise.all(
      keywordGroupStats.map(async (stat) => {
        const keywordGroup = await prisma.keywordGroup.findUnique({
          where: { id: stat.keywordGroupId },
        })
        return {
          keywordGroupId: stat.keywordGroupId,
          keywordGroupName: keywordGroup?.name || '未命名',
          count: stat._count,
          avgWeight: stat._avg.weight || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        totalNews,
        matchedNews,
        matchRate,
        avgWeight: avgWeightResult._avg.weight || 0,
        platformStats: platformStatsWithNames,
        keywordGroupStats: keywordGroupStatsWithNames,
        dateRange: {
          start: dateFrom.toISOString(),
          end: dateTo.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

