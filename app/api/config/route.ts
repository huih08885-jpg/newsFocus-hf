import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// 强制动态渲染（因为使用了 searchParams）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key')

    if (key) {
      const config = await prisma.systemConfig.findUnique({
        where: { key },
      })

      if (!config) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Config not found',
            },
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: config.value,
      })
    }

    // 返回所有配置
    const configs = await prisma.systemConfig.findMany()
    const configMap: Record<string, any> = {}

    for (const config of configs) {
      configMap[config.key] = config.value
    }

    return NextResponse.json({
      success: true,
      data: configMap,
    })
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // 更新配置
    for (const [key, value] of Object.entries(body)) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value: value as any },
        create: {
          key,
          value: value as any,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: { message: '配置已更新' },
    })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

