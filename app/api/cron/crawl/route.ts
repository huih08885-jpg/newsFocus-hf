import { NextRequest, NextResponse } from 'next/server'

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 定时爬虫任务
 * GET /api/cron/crawl
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
