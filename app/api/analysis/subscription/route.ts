import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { AIAnalysisService } from '@/lib/services/ai-analysis'

export const dynamic = 'force-dynamic'

/**
 * 获取用户订阅信息
 * GET /api/analysis/subscription
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

    const analysisService = new AIAnalysisService(prisma)
    const subscription = await analysisService.getUserSubscription(user.id)

    return NextResponse.json({
      success: true,
      data: subscription,
    })
  } catch (error) {
    console.error('[AnalysisAPI] 获取订阅信息失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '获取订阅信息失败',
        },
      },
      { status: 500 }
    )
  }
}

