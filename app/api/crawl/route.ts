import { NextRequest, NextResponse } from 'next/server'

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 手动触发爬取
 * POST /api/crawl
 */
export async function POST(request: NextRequest) {
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

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 获取爬取任务状态
 * GET /api/crawl
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
