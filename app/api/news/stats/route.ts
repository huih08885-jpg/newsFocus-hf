import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * 获取按关键词组分组的新闻统计
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const platforms = searchParams.get('platforms')?.split(',')
    const dateFrom = searchParams.get('dateFrom') 
      ? new Date(searchParams.get('dateFrom')!) 
      : undefined
    const dateTo = searchParams.get('dateTo') 
      ? new Date(searchParams.get('dateTo')!) 
      : undefined
    const timeFilterType = searchParams.get('timeFilterType') as 'publishedAt' | 'crawledAt' | null || 'crawledAt' // 时间筛选类型，默认为爬取时间

    // 构建基础查询条件
    const baseWhere: any = {}
    
    if (platforms && platforms.length > 0) {
      baseWhere.platformId = { in: platforms }
    }
    
    // 根据时间筛选类型设置不同的时间字段
    if (dateFrom || dateTo) {
      const timeField = timeFilterType === 'publishedAt' ? 'publishedAt' : 'crawledAt'
      baseWhere[timeField] = {}
      if (dateFrom) baseWhere[timeField].gte = dateFrom
      if (dateTo) baseWhere[timeField].lte = dateTo
    }

    // 获取所有启用的关键词组
    const keywordGroups = await prisma.keywordGroup.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' },
    })

    // 获取全量新闻统计
    // 如果没有过滤条件，baseWhere 为空对象，Prisma 会统计所有记录
    const totalNewsCount = await prisma.newsItem.count({
      where: Object.keys(baseWhere).length > 0 ? baseWhere : undefined,
    })
    
    console.log('[Stats API] 全量新闻统计:', {
      totalNewsCount,
      hasFilters: Object.keys(baseWhere).length > 0,
      filters: baseWhere,
    })

    // 获取每个关键词组的统计
    const groupStats = await Promise.all(
      keywordGroups.map(async (group) => {
        // 统计该关键词组匹配的新闻数量
        const matchCount = await prisma.newsMatch.count({
          where: {
            keywordGroupId: group.id,
            newsItem: baseWhere,
          },
        })

        // 获取平均权重
        const avgWeightResult = await prisma.newsMatch.aggregate({
          where: {
            keywordGroupId: group.id,
            newsItem: baseWhere,
          },
          _avg: {
            weight: true,
          },
        })

        // 获取最大权重
        const maxWeightResult = await prisma.newsMatch.findFirst({
          where: {
            keywordGroupId: group.id,
            newsItem: baseWhere,
          },
          orderBy: {
            weight: 'desc',
          },
          select: {
            weight: true,
          },
        })

        return {
          id: group.id,
          name: group.name || '未命名',
          count: matchCount,
          avgWeight: avgWeightResult._avg.weight || 0,
          maxWeight: maxWeightResult?.weight || 0,
        }
      })
    )

    // 过滤掉没有匹配新闻的关键词组
    const activeGroups = groupStats.filter(stat => stat.count > 0)

    return NextResponse.json({
      success: true,
      data: {
        totalNews: totalNewsCount,
        keywordGroups: activeGroups,
        allGroups: groupStats, // 包含所有组，即使没有匹配
      },
    })
  } catch (error) {
    console.error('Error fetching news stats:', error)
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

