import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { handleError } from '@/lib/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * 获取用户的所有标签
 * GET /api/collections/tags
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
            message: '需要登录才能查看标签',
          },
        },
        { status: 401 }
      )
    }

    // 获取所有收藏记录
    const collections = await prisma.userCollection.findMany({
      where: {
        userId: user.id,
      },
      select: {
        tags: true,
      },
    })

    // 统计标签使用次数
    const tagCounts = new Map<string, number>()
    collections.forEach((collection) => {
      collection.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    // 转换为数组并按使用次数排序
    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      data: tags,
    })
  } catch (error) {
    console.error('Error getting tags:', error)
    return handleError(error, '获取标签失败')
  }
}

