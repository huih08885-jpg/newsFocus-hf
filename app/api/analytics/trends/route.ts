import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const keywordGroupId = searchParams.get('keywordGroupId')
    const dateFrom = searchParams.get('dateFrom')
      ? new Date(searchParams.get('dateFrom')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 默认30天前
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : new Date()
    const granularity = searchParams.get('granularity') || 'day' // hour, day, week

    if (!keywordGroupId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAM',
            message: 'keywordGroupId is required',
          },
        },
        { status: 400 }
      )
    }

    // 查询匹配记录
    const matches = await prisma.newsMatch.findMany({
      where: {
        keywordGroupId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        newsItem: {
          include: {
            platform: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // 按时间粒度分组
    const trendsMap = new Map<string, { count: number; totalWeight: number }>()

    for (const match of matches) {
      const date = new Date(match.createdAt)
      let key: string

      if (granularity === 'hour') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
      } else if (granularity === 'week') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, '0')}`
      } else {
        // day
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }

      const existing = trendsMap.get(key) || { count: 0, totalWeight: 0 }
      trendsMap.set(key, {
        count: existing.count + 1,
        totalWeight: existing.totalWeight + match.weight,
      })
    }

    // 转换为数组格式
    const trends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        avgWeight: data.totalWeight / data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 获取关键词组信息
    const keywordGroup = await prisma.keywordGroup.findUnique({
      where: { id: keywordGroupId },
    })

    return NextResponse.json({
      success: true,
      data: {
        trends,
        keywordGroup: {
          id: keywordGroup?.id,
          name: keywordGroup?.name,
        },
        dateRange: {
          start: dateFrom.toISOString(),
          end: dateTo.toISOString(),
        },
        granularity,
      },
    })
  } catch (error) {
    console.error('Error fetching trends:', error)
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

