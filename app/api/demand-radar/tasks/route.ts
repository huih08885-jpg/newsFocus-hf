import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * 获取需求雷达任务列表
 * GET /api/demand-radar/tasks?limit=10
 * 
 * ========== 已注释：需求雷达模块相关API ==========
 */
export async function GET(request: NextRequest) {
  // ========== 已注释：需求雷达模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '需求雷达模块已禁用',
      },
    },
    { status: 503 }
  )
  
  /* ========== 原始代码已注释 ==========
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    const tasks = await prisma.demandRadarTask.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        items: tasks,
        total: tasks.length,
      },
    })
  } catch (error) {
    console.error('[DemandRadar API] 获取任务列表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : '未知错误',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

