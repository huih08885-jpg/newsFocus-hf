import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { AIAnalysisService } from '@/lib/services/ai-analysis'

export const dynamic = 'force-dynamic'

/**
 * 获取用户的分析任务列表
 * GET /api/analysis/list?type=personal&status=completed&page=1&pageSize=20
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要登录',
          },
        },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'personal' | 'trend' | 'business' | undefined
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const analysisService = new AIAnalysisService(prisma)
    const result = await analysisService.getUserAnalyses(user.id, {
      type,
      status,
      page,
      pageSize,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[AnalysisAPI] 获取分析列表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '获取分析列表失败',
        },
      },
      { status: 500 }
    )
  }
}

