import { NextRequest, NextResponse } from 'next/server'
// ========== 新闻聚焦功能已禁用，仅保留福利彩票功能 ==========
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '新闻聚焦模块已禁用，仅保留福利彩票功能',
      },
    },
    { status: 503 }
  )
  
  /* ========== 原始代码已注释 ==========
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/services/cache'

// 强制动态渲染（因为使用了 searchParams）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const platforms = searchParams.get('platforms')?.split(',')
    const keywordGroupId = searchParams.get('keywordGroupId')
    const minWeight = searchParams.get('minWeight') 
      ? Number(searchParams.get('minWeight')) 
      : undefined
    const dateFrom = searchParams.get('dateFrom') 
      ? new Date(searchParams.get('dateFrom')!) 
      : undefined
    const dateTo = searchParams.get('dateTo') 
      ? new Date(searchParams.get('dateTo')!) 
      : undefined
    const timeFilterType = searchParams.get('timeFilterType') as 'publishedAt' | 'crawledAt' | null || 'crawledAt' // 时间筛选类型，默认为爬取时间
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const offset = Number(searchParams.get('offset') || 0)
    const sortBy = searchParams.get('sortBy') || 'crawledAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const skipCache = searchParams.get('skipCache') === 'true' // 用于调试，跳过缓存

    // 构建缓存key
    const cacheKey = `news:${JSON.stringify({
      platforms,
      keywordGroupId,
      minWeight,
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString(),
      timeFilterType,
      limit,
      offset,
      sortBy,
      sortOrder,
    })}`

    // 尝试从缓存获取（除非明确要求跳过）
    if (!skipCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true,
        })
      }
    }

    const where: any = {}

    if (platforms && platforms.length > 0) {
      where.platformId = { in: platforms }
    }

    // 根据时间筛选类型设置不同的时间字段
    if (dateFrom || dateTo) {
      const timeField = timeFilterType === 'publishedAt' ? 'publishedAt' : 'crawledAt'
      where[timeField] = {}
      if (dateFrom) where[timeField].gte = dateFrom
      if (dateTo) where[timeField].lte = dateTo
    }

    // 如果指定了关键词组或最小权重，需要通过matches查询
    let items: any[] = []
    let total = 0

    if (keywordGroupId || minWeight) {
      // 先查询匹配记录
      const matchWhere: any = {}
      if (keywordGroupId) matchWhere.keywordGroupId = keywordGroupId
      if (minWeight) matchWhere.weight = { gte: minWeight }

      const matches = await prisma.newsMatch.findMany({
        where: matchWhere,
        include: {
          newsItem: {
            include: {
              platform: true,
            },
          },
          keywordGroup: true,
        },
        orderBy: { weight: 'desc' },
      })

      // 过滤新闻项（根据 where 条件）
      let filteredMatches = matches.filter((match) => {
        if (!match.newsItem) return false
        
        const item = match.newsItem
        
        // 平台过滤
        if (platforms && platforms.length > 0) {
          if (!platforms.includes(item.platformId)) return false
        }
        
        // 日期过滤（根据时间筛选类型）
        if (dateFrom || dateTo) {
          const timeField = timeFilterType === 'publishedAt' ? item.publishedAt : item.crawledAt
          if (!timeField) {
            // 如果筛选发布时间但该新闻没有发布时间，则过滤掉
            if (timeFilterType === 'publishedAt') return false
            // 否则使用爬取时间作为后备
            const crawledAt = new Date(item.crawledAt)
            if (dateFrom && crawledAt < dateFrom) return false
            if (dateTo && crawledAt > dateTo) return false
          } else {
            const timeValue = new Date(timeField)
            if (dateFrom && timeValue < dateFrom) return false
            if (dateTo && timeValue > dateTo) return false
          }
        }
        
        return true
      })

      // 转换并分页
      items = filteredMatches
        .map((match) => ({
          ...match.newsItem,
          matches: [{
            keywordGroup: match.keywordGroup,
            weight: match.weight,
            matchCount: match.matchCount,
          }],
        }))
        .slice(offset, offset + limit)

      total = filteredMatches.length
    } else {
      // 直接查询新闻
      // 如果按 weight 排序，需要通过 matches 关系排序
      if (sortBy === 'weight') {
        // 通过 matches 查询，按最大 weight 排序
        const newsItemsWithMatches = await prisma.newsItem.findMany({
          where,
          include: {
            platform: true,
            matches: {
              include: {
                keywordGroup: true,
              },
              orderBy: { weight: 'desc' },
            },
          },
          take: limit * 2, // 多取一些，因为后面要按 weight 排序
          skip: offset,
        })

        // 按最大 weight 排序
        const sortedItems = newsItemsWithMatches
          .map((item) => ({
            ...item,
            maxWeight: item.matches.length > 0 
              ? Math.max(...item.matches.map(m => m.weight))
              : 0,
          }))
          .sort((a, b) => {
            if (sortOrder === 'desc') {
              return b.maxWeight - a.maxWeight
            }
            return a.maxWeight - b.maxWeight
          })
          .slice(0, limit)

        items = sortedItems.map(({ maxWeight, ...item }) => item)
        total = await prisma.newsItem.count({ where })
      } else {
        // 其他字段直接排序
        const [newsItems, newsTotal] = await Promise.all([
          prisma.newsItem.findMany({
            where,
            include: {
              platform: true,
              matches: {
                include: {
                  keywordGroup: true,
                },
              },
            },
            orderBy: { [sortBy]: sortOrder },
            take: limit,
            skip: offset,
          }),
          prisma.newsItem.count({ where }),
        ])

        items = newsItems
        total = newsTotal
      }
    }

    const result = {
      items,
      total,
      limit,
      offset,
    }

    // 写入缓存（5分钟）
    await cache.set(cacheKey, result, 300)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const { handleError } = await import('@/lib/utils/error-handler')
    return handleError(error, 'NewsAPI', '获取新闻列表失败')
  }
}
========== 原始代码结束 ========== */
