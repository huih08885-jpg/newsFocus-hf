import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { AIAnalysisService } from '@/lib/services/ai-analysis'

export const dynamic = 'force-dynamic'

/**
 * 创建 AI 分析任务
 * POST /api/analysis/create
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { type, sourceType, sourceId, customPrompt, startDate, endDate, maxItems } = body

    // 验证参数
    if (!type || !sourceType || !sourceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺少必需参数：type, sourceType, sourceId',
          },
        },
        { status: 400 }
      )
    }

    if (!['personal', 'trend', 'business'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'type 必须是 personal, trend 或 business',
          },
        },
        { status: 400 }
      )
    }

    if (!['keyword', 'site_group'].includes(sourceType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sourceType 必须是 keyword 或 site_group',
          },
        },
        { status: 400 }
      )
    }

    const analysisService = new AIAnalysisService(prisma)

    // 创建分析任务
    const { taskId } = await analysisService.createAnalysis(user.id, {
      type,
      sourceType,
      sourceId,
      customPrompt,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      maxItems: maxItems ? parseInt(maxItems) : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        taskId,
      },
    })
  } catch (error) {
    console.error('[AnalysisAPI] 创建分析任务失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '创建分析任务失败',
        },
      },
      { status: 500 }
    )
  }
}

