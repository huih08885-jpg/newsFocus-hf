import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  crawlerTypes: z.array(z.enum(['default', 'site', 'keyword'])).optional(),
  platformIds: z.array(z.string()).optional(),
  siteIds: z.array(z.string()).optional(),
  keywordGroupIds: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(['all', 'success', 'failed', 'running', 'pending']).optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
})

/**
 * 组合查询三种爬虫的数据
 * GET /api/crawlers/query?crawlerTypes=default,site&platformIds=zhihu&dateFrom=...
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function GET(request: NextRequest) {
  // ========== 已注释：爬虫管理模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '爬虫管理模块已禁用',
      },
    },
    { status: 503 }
  )
  
  /* ========== 原始代码已注释 ==========
  try {
    await getCurrentUser()

    const searchParams = request.nextUrl.searchParams
    const crawlerTypes = searchParams.get('crawlerTypes')?.split(',') || ['default', 'site', 'keyword']
    const platformIds = searchParams.get('platformIds')?.split(',').filter(Boolean)
    const siteIds = searchParams.get('siteIds')?.split(',').filter(Boolean)
    const keywordGroupIds = searchParams.get('keywordGroupIds')?.split(',').filter(Boolean)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const status = searchParams.get('status') || 'all'
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const offset = Number(searchParams.get('offset') || 0)

    const input = querySchema.parse({
      crawlerTypes,
      platformIds,
      siteIds,
      keywordGroupIds,
      dateFrom,
      dateTo,
      status,
      limit,
      offset,
    })

    const dateFromDate = input.dateFrom ? new Date(input.dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const dateToDate = input.dateTo ? new Date(input.dateTo) : new Date()

    const results: any[] = []

    // 1. 默认爬虫（多平台热点）数据
    if (input.crawlerTypes.includes('default')) {
      const where: any = {
        crawledAt: {
          gte: dateFromDate,
          lte: dateToDate,
        },
      }

      if (input.platformIds && input.platformIds.length > 0) {
        where.platformId = { in: input.platformIds }
      }

      const newsItems = await prisma.newsItem.findMany({
        where,
        include: {
          platform: true,
          matches: {
            include: {
              keywordGroup: true,
            },
            take: 1,
          },
        },
        orderBy: {
          crawledAt: 'desc',
        },
        take: limit,
        skip: offset,
      })

      results.push(
        ...newsItems.map((item) => ({
          type: 'default',
          id: item.id,
          title: item.title,
          url: item.url,
          mobileUrl: item.mobileUrl,
          platform: {
            id: item.platform.platformId,
            name: item.platform.name,
          },
          rank: item.rank,
          crawledAt: item.crawledAt,
          publishedAt: item.publishedAt,
          keywordGroup: item.matches[0]?.keywordGroup?.name || null,
          weight: item.matches[0]?.weight || null,
        }))
      )
    }

    // 2. 搜索爬虫（站点爬虫）数据
    if (input.crawlerTypes.includes('site')) {
      let siteQuery = `
        SELECT 
          scr.id,
          scr.title,
          scr.url,
          scr.summary,
          scr.published_at,
          scr.crawled_at,
          sc.id as site_id,
          sc.domain,
          sc.name as site_name,
          sct.status,
          sct.type
        FROM site_crawl_results scr
        JOIN site_candidates sc ON scr.site_id = sc.id
        JOIN site_crawl_tasks sct ON scr.task_id = sct.id
        WHERE scr.crawled_at >= $1 AND scr.crawled_at <= $2
      `

      const params: any[] = [dateFromDate, dateToDate]
      let paramIndex = 3

      if (input.siteIds && input.siteIds.length > 0) {
        siteQuery += ` AND sc.id = ANY($${paramIndex}::uuid[])`
        params.push(input.siteIds)
        paramIndex++
      }

      if (input.status !== 'all') {
        siteQuery += ` AND sct.status = $${paramIndex}`
        params.push(input.status)
        paramIndex++
      }

      siteQuery += ` ORDER BY scr.crawled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      params.push(limit, offset)

      const siteResults = (await prisma.$queryRawUnsafe(siteQuery, ...params)) as any[]

      results.push(
        ...siteResults.map((item: any) => ({
          type: 'site',
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          site: {
            id: item.site_id,
            domain: item.domain,
            name: item.site_name,
          },
          publishedAt: item.published_at,
          crawledAt: item.crawled_at,
          status: item.status,
          taskType: item.type,
        }))
      )
    }

    // 3. 关键词爬虫数据（匹配记录）
    if (input.crawlerTypes.includes('keyword')) {
      const where: any = {
        createdAt: {
          gte: dateFromDate,
          lte: dateToDate,
        },
      }

      if (input.keywordGroupIds && input.keywordGroupIds.length > 0) {
        where.keywordGroupId = { in: input.keywordGroupIds }
      }

      const matches = await prisma.newsMatch.findMany({
        where,
        include: {
          newsItem: {
            include: {
              platform: true,
            },
          },
          keywordGroup: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      })

      results.push(
        ...matches.map((match) => ({
          type: 'keyword',
          id: match.id,
          newsItem: {
            id: match.newsItem.id,
            title: match.newsItem.title,
            url: match.newsItem.url,
            mobileUrl: match.newsItem.mobileUrl,
            platform: {
              id: match.newsItem.platform.platformId,
              name: match.newsItem.platform.name,
            },
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
      )
    }

    // 按时间排序
    results.sort((a, b) => {
      const timeA = a.crawledAt || a.lastMatchedAt || new Date(0)
      const timeB = b.crawledAt || b.lastMatchedAt || new Date(0)
      return timeB.getTime() - timeA.getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        items: results.slice(0, limit),
        total: results.length,
        limit: input.limit,
        offset: input.offset,
      },
    })
  } catch (error) {
    console.error('Error querying crawlers:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : '查询失败',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

