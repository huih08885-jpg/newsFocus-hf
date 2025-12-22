import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 获取用户的所有标签
 * GET /api/collections/tags
 * 
 * 注意：此功能已禁用（新闻聚焦模块已移除）
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '新闻聚焦模块已禁用',
      },
    },
    { status: 503 }
  )
}

