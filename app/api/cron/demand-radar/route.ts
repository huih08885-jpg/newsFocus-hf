import { NextRequest, NextResponse } from 'next/server'

/**
 * 定时任务：每天自动执行需求雷达
 * GET /api/cron/demand-radar
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
