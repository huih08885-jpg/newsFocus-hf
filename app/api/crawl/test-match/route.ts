import { NextRequest, NextResponse } from 'next/server'

/**
 * 测试关键词匹配功能
 * POST /api/crawl/test-match
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
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
