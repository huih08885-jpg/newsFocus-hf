import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/services/cache'

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
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const offset = Number(searchParams.get('offset') || 0)
    const sortBy = searchParams.get('sortBy') || 'crawledAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 构建缓存key
    const cacheKey = `news:${JSON.stringify({
      platforms,
      keywordGroupId,
      minWeight,
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString(),
      limit,
      offset,
      sortBy,
      sortOrder,
    })}`

    // 尝试从缓存获取
    const cached = await cache.get(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      })
    }

    const where: any = {}

    if (platforms && platforms.length > 0) {
      where.platformId = { in: platforms }
    }

    if (dateFrom || dateTo) {
      where.crawledAt = {}
      if (dateFrom) where.crawledAt.gte = dateFrom
      if (dateTo) where.crawledAt.lte = dateTo
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
        
        // 日期过滤
        if (dateFrom || dateTo) {
          const crawledAt = new Date(item.crawledAt)
          if (dateFrom && crawledAt < dateFrom) return false
          if (dateTo && crawledAt > dateTo) return false
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
    console.error('Error fetching news:', error)
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

