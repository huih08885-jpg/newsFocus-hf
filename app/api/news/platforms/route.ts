import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * 获取各平台的最新热点新闻
 * GET /api/news/platforms?limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Number(searchParams.get('limit') || 10), 20) // 每个平台最多20条

    // 获取所有启用的平台
    const platforms = await prisma.platform.findMany({
      where: { enabled: true },
      orderBy: { platformId: 'asc' },
    })

    // 获取每个平台的最新新闻
    const platformNews = await Promise.all(
      platforms.map(async (platform) => {
        // 获取该平台最新的新闻
        const newsItems = await prisma.newsItem.findMany({
          where: {
            platformId: platform.platformId,
          },
          orderBy: {
            crawledAt: 'desc',
          },
          take: limit,
          include: {
            matches: {
              include: {
                keywordGroup: true,
              },
              orderBy: {
                weight: 'desc',
              },
              take: 1, // 只取权重最高的匹配
            },
          },
        })

        // 获取最新更新时间
        const latestUpdate = newsItems.length > 0 
          ? newsItems[0].crawledAt 
          : null

        return {
          platform: {
            id: platform.id,
            platformId: platform.platformId,
            name: platform.name,
          },
          items: newsItems.map((item, index) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            mobileUrl: item.mobileUrl,
            rank: item.rank,
            crawledAt: item.crawledAt,
            weight: item.matches[0]?.weight || 0,
            keywordGroup: item.matches[0]?.keywordGroup?.name || null,
          })),
          latestUpdate,
          count: newsItems.length,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: platformNews,
    })
  } catch (error) {
    console.error('Error fetching platform news:', error)
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

