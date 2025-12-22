import { NextRequest, NextResponse } from 'next/server'

/**
 * 获取需求雷达任务列表
 * GET /api/demand-radar/tasks?limit=10
 * 
 * ========== 已注释：需求雷达模块相关API ==========
 */
export async function GET(request: NextRequest) {
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
}
