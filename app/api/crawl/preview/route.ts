import { NextRequest, NextResponse } from 'next/server'

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 预览爬取结果
 * POST /api/crawl/preview
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
