import { NextRequest, NextResponse } from 'next/server'

/**
 * 组合查询三种爬虫的数据
 * GET /api/crawlers/query?crawlerTypes=default,site&platformIds=zhihu&dateFrom=...
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
