import { NextRequest, NextResponse } from 'next/server'

// ========== 新闻聚焦功能已禁用，仅保留福利彩票功能 ==========
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '新闻聚焦模块已禁用，仅保留福利彩票功能',
      },
    },
    { status: 503 }
  )
}
