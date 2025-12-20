import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * 获取三种爬虫的统计信息
 * GET /api/crawlers/stats
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
    const dateFrom = searchParams.get('dateFrom')
      ? new Date(searchParams.get('dateFrom')!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 默认最近7天
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : new Date()

    // 1. 默认爬虫（多平台热点）统计
    const defaultCrawlerStats = await Promise.all([
      // 任务统计
      prisma.crawlTask.count({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // 成功任务数
      prisma.crawlTask.count({
        where: {
          status: 'completed',
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // 失败任务数
      prisma.crawlTask.count({
        where: {
          status: 'failed',
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // 新闻总数
      prisma.newsItem.count({
        where: {
          crawledAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // 平台统计
      prisma.newsItem.groupBy({
        by: ['platformId'],
        where: {
          crawledAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _count: {
          id: true,
        },
      }),
    ])

    const [taskCount, successTaskCount, failedTaskCount, newsCount, platformStats] =
      defaultCrawlerStats

    // 2. 搜索爬虫（站点爬虫）统计
    const siteCrawlerStats = await Promise.all([
      // 任务统计
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count
        FROM site_crawl_tasks
        WHERE created_at >= $1 AND created_at <= $2
      `, dateFrom, dateTo) as Promise<Array<{ count: number }>>,
      // 成功任务数
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count
        FROM site_crawl_tasks
        WHERE status = 'completed' AND created_at >= $1 AND created_at <= $2
      `, dateFrom, dateTo) as Promise<Array<{ count: number }>>,
      // 失败任务数
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count
        FROM site_crawl_tasks
        WHERE status = 'failed' AND created_at >= $1 AND created_at <= $2
      `, dateFrom, dateTo) as Promise<Array<{ count: number }>>,
      // 结果总数
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count
        FROM site_crawl_results
        WHERE crawled_at >= $1 AND crawled_at <= $2
      `, dateFrom, dateTo) as Promise<Array<{ count: number }>>,
      // 站点统计
      prisma.$queryRawUnsafe(`
        SELECT 
          sc.id,
          sc.domain,
          sc.name,
          COUNT(scr.id)::int as result_count
        FROM site_candidates sc
        LEFT JOIN site_crawl_results scr ON scr.site_id = sc.id
          AND scr.crawled_at >= $1 AND scr.crawled_at <= $2
        WHERE sc.crawl_enabled = true
        GROUP BY sc.id, sc.domain, sc.name
        HAVING COUNT(scr.id) > 0
        ORDER BY result_count DESC
        LIMIT 10
      `, dateFrom, dateTo) as Promise<Array<{ id: string; domain: string; name: string | null; result_count: number }>>,
    ])

    const [
      siteTaskCountResult,
      siteSuccessTaskCountResult,
      siteFailedTaskCountResult,
      siteResultCountResult,
      siteStatsResult,
    ] = siteCrawlerStats

    const siteTaskCount = siteTaskCountResult[0]?.count || 0
    const siteSuccessTaskCount = siteSuccessTaskCountResult[0]?.count || 0
    const siteFailedTaskCount = siteFailedTaskCountResult[0]?.count || 0
    const siteResultCount = siteResultCountResult[0]?.count || 0
    const siteStats = siteStatsResult.map((s) => ({
      id: s.id,
      domain: s.domain,
      name: s.name,
      count: s.result_count,
    }))

    // 3. 关键词爬虫统计
    const keywordCrawlerStats = await Promise.all([
      // 关键词组数
      prisma.keywordGroup.count({
        where: {
          enabled: true,
        },
      }),
      // 匹配记录数
      prisma.newsMatch.count({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // 关键词组匹配统计
      prisma.newsMatch.groupBy({
        by: ['keywordGroupId'],
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),
    ])

    const [keywordGroupCount, matchCount, keywordGroupStats] = keywordCrawlerStats

    // 获取关键词组名称
    const keywordGroupIds = keywordGroupStats.map((s) => s.keywordGroupId)
    const keywordGroups = await prisma.keywordGroup.findMany({
      where: {
        id: {
          in: keywordGroupIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    const keywordGroupMap = new Map(keywordGroups.map((kg) => [kg.id, kg.name]))

    return NextResponse.json({
      success: true,
      data: {
        defaultCrawler: {
          taskCount: taskCount,
          successTaskCount: successTaskCount,
          failedTaskCount: failedTaskCount,
          newsCount: newsCount,
          platformStats: platformStats.map((p) => ({
            platformId: p.platformId,
            count: p._count.id,
          })),
        },
        siteCrawler: {
          taskCount: siteTaskCount,
          successTaskCount: siteSuccessTaskCount,
          failedTaskCount: siteFailedTaskCount,
          resultCount: siteResultCount,
          siteStats: siteStats,
        },
        keywordCrawler: {
          keywordGroupCount: keywordGroupCount,
          matchCount: matchCount,
          keywordGroupStats: keywordGroupStats.map((s) => ({
            keywordGroupId: s.keywordGroupId,
            keywordGroupName: keywordGroupMap.get(s.keywordGroupId) || '未命名',
            matchCount: s._count.id,
          })),
        },
        dateRange: {
          from: dateFrom,
          to: dateTo,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching crawler stats:', error)
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

