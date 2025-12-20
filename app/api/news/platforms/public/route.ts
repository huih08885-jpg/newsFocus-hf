import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * 公开的多平台热点 API（无需登录）
 * GET /api/news/platforms/public
 */

// 强制动态渲染（因为使用了 searchParams）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Number(searchParams.get('limit') || 10), 20)

    const platforms = await prisma.platform.findMany({
      where: { enabled: true },
      orderBy: { platformId: 'asc' },
    })

    const platformNews = await Promise.all(
      platforms.map(async (platform) => {
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
              take: 1,
            },
          },
        })

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
            content: item.content,
            publishedAt: item.publishedAt,
            rank: item.rank,
            crawledAt: item.crawledAt,
            weight: item.matches[0]?.weight || 0,
            keywordGroup: item.matches[0]?.keywordGroup?.name || null,
            sentiment: item.sentiment,
            sentimentScore: item.sentimentScore,
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

