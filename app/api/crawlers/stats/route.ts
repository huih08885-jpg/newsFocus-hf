import { NextRequest, NextResponse } from 'next/server'

/**
 * 获取三种爬虫的统计信息
 * GET /api/crawlers/stats
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '爬虫管理模块已禁用',
      },
    },
    { status: 503 }
  )
}
