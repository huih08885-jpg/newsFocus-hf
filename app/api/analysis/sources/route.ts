import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * 获取可用的数据源列表
 * GET /api/analysis/sources?type=keyword|site_group
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要登录',
          },
        },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'keyword' | 'site_group' | null

    if (type === 'keyword') {
      // 获取关键词组列表
      const groups = await prisma.keywordGroup.findMany({
        where: {
          enabled: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({
        success: true,
        data: groups.map(g => ({
          id: g.id,
          name: g.name || '未命名关键词组',
        })),
      })
    } else if (type === 'site_group') {
      // 获取站点分组列表
      const groups = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(`
        SELECT id, name 
        FROM site_groups 
        ORDER BY created_at DESC
      `)

      return NextResponse.json({
        success: true,
        data: groups.map(g => ({
          id: g.id,
          name: g.name || '未命名分组',
        })),
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'type 参数必须是 keyword 或 site_group',
          },
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[AnalysisAPI] 获取数据源列表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '获取数据源列表失败',
        },
      },
      { status: 500 }
    )
  }
}

