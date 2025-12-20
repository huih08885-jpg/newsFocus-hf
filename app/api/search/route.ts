import { NextRequest, NextResponse } from 'next/server'
import { SearchService } from '@/lib/services/search'
import { handleError } from '@/lib/utils/error-handler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const searchSchema = z.object({
  q: z.string().min(1).max(200), // 搜索关键词
  platforms: z.string().optional(), // 平台，逗号分隔
  dateFrom: z.string().optional(), // ISO日期字符串
  dateTo: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  keywordGroupId: z.string().optional(),
  minWeight: z.string().optional(), // 数字字符串
  limit: z.string().optional(),
  offset: z.string().optional(),
  sortBy: z.enum(['relevance', 'crawledAt', 'weight', 'rank']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/**
 * 搜索新闻
 * GET /api/search?q=关键词&platforms=zhihu,weibo&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '搜索关键词不能为空',
          },
        },
        { status: 400 }
      )
    }

    // 解析参数
    const platforms = searchParams.get('platforms')?.split(',').filter(Boolean)
    const dateFrom = searchParams.get('dateFrom')
      ? new Date(searchParams.get('dateFrom')!)
      : undefined
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : undefined
    const sentiment = searchParams.get('sentiment') as
      | 'positive'
      | 'negative'
      | 'neutral'
      | undefined
    const keywordGroupId = searchParams.get('keywordGroupId') || undefined
    const minWeight = searchParams.get('minWeight')
      ? Number(searchParams.get('minWeight'))
      : undefined
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100)
    const offset = Number(searchParams.get('offset') || 0)
    const sortBy =
      (searchParams.get('sortBy') as
        | 'relevance'
        | 'crawledAt'
        | 'weight'
        | 'rank') || 'relevance'
    const sortOrder =
      (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    const searchService = new SearchService()
    const results = await searchService.search({
      query: query.trim(),
      platforms,
      dateFrom,
      dateTo,
      sentiment,
      keywordGroupId,
      minWeight,
      limit,
      offset,
      sortBy,
      sortOrder,
    })

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('Error searching:', error)
    return handleError(error, 'SearchAPI', '搜索失败')
  }
}

