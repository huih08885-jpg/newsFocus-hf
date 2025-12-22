import { NextRequest, NextResponse } from 'next/server'

/**
 * 手动触发需求雷达任务
 * POST /api/demand-radar/run
 * 
 * ========== 已注释：需求雷达模块相关API ==========
 */
export async function POST(request: NextRequest) {
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
