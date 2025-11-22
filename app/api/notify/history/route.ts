import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const channel = searchParams.get('channel')
    const dateFrom = searchParams.get('dateFrom')
      ? new Date(searchParams.get('dateFrom')!)
      : undefined
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : undefined
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const offset = Number(searchParams.get('offset') || 0)

    const where: any = {}

    if (channel) {
      where.channel = channel
    }

    if (dateFrom || dateTo) {
      where.reportDate = {}
      if (dateFrom) where.reportDate.gte = dateFrom
      if (dateTo) where.reportDate.lte = dateTo
    }

    const [items, total] = await Promise.all([
      prisma.pushRecord.findMany({
        where,
        orderBy: { pushedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pushRecord.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Error fetching push history:', error)
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

