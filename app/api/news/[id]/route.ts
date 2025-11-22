import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const newsItem = await prisma.newsItem.findUnique({
      where: { id: params.id },
      include: {
        platform: true,
        matches: {
          include: {
            keywordGroup: true,
          },
        },
        appearances: {
          orderBy: { appearedAt: 'desc' },
        },
      },
    })

    if (!newsItem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'News item not found',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newsItem,
    })
  } catch (error) {
    console.error('Error fetching news detail:', error)
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

