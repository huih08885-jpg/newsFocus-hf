import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

// 强制动态渲染（因为使用了 cookies）
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: '邮箱和密码不能为空',
          },
        },
        { status: 400 }
      )
    }

    // 查找用户
    if (!prisma) {
      throw new Error('Prisma client is not initialized')
    }
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码错误',
          },
        },
        { status: 401 }
      )
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码错误',
          },
        },
        { status: 401 }
      )
    }

    // 创建会话
    const sessionToken = await createSession(user.id)

    // 设置 Cookie
    const cookieStore = await cookies()
    cookieStore.set('newsfocus_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    })
  } catch (error) {
    const { handleError } = await import('@/lib/utils/error-handler')
    return handleError(error, 'AuthAPI', '登录失败')
  }
}

