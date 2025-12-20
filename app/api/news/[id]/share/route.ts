import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ShareService, SharePlatform } from '@/lib/services/share'
import { handleError } from '@/lib/utils/errors'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const shareSchema = z.object({
  platform: z.enum(['weibo', 'wechat', 'qq', 'douban', 'link', 'copy']),
})

/**
 * 记录分享行为
 * POST /api/news/[id]/share
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser() // 允许未登录用户分享
    const body = await request.json()
    const { platform } = shareSchema.parse(body)

    const shareService = new ShareService()
    await shareService.recordShare(user?.id || null, params.id, platform as SharePlatform)

    return NextResponse.json({
      success: true,
      message: '分享记录成功',
    })
  } catch (error) {
    console.error('Error recording share:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }
    return handleError(error, '记录分享失败')
  }
}

