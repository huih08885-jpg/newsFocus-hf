import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'
import { cookies } from 'next/headers'

// 强制动态渲染（因为使用了 cookies）
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('newsfocus_session')?.value

    if (sessionToken) {
      await deleteSession(sessionToken)
    }

    // 清除 Cookie
    cookieStore.delete('newsfocus_session')

    return NextResponse.json({
      success: true,
      message: '已退出登录',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: '退出登录失败',
        },
      },
      { status: 500 }
    )
  }
}

