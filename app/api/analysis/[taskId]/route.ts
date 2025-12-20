import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { AIAnalysisService } from '@/lib/services/ai-analysis'

export const dynamic = 'force-dynamic'

/**
 * 获取分析任务详情
 * GET /api/analysis/:taskId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
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

    const analysisService = new AIAnalysisService(prisma)
    const analysis = await analysisService.getAnalysis(params.taskId, user.id)

    if (!analysis) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '分析任务不存在',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (error) {
    console.error('[AnalysisAPI] 获取分析任务失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '获取分析任务失败',
        },
      },
      { status: 500 }
    )
  }
}

