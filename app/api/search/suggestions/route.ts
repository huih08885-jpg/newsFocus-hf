import { NextRequest, NextResponse } from 'next/server'
import { SearchService } from '@/lib/services/search'
import { handleError } from '@/lib/utils/error-handler'

export const dynamic = 'force-dynamic'

/**
 * 获取搜索建议（自动完成）
 * GET /api/search/suggestions?q=关键词&limit=5
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = Math.min(Number(searchParams.get('limit') || 5), 10)

    if (query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const searchService = new SearchService()
    const suggestions = await searchService.getSuggestions(query.trim(), limit)

    return NextResponse.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return handleError(error, 'SearchSuggestionsAPI', '获取搜索建议失败')
  }
}

