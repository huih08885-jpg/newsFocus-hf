import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const keywordGroup = await prisma.keywordGroup.findUnique({
      where: { id: params.id },
    })

    if (!keywordGroup) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '关键词组不存在',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: keywordGroup,
    })
  } catch (error) {
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, words, requiredWords, excludedWords, priority, enabled, customWebsites } = body

    // 验证 customWebsites 格式
    let validatedCustomWebsites = null
    if (customWebsites && Array.isArray(customWebsites)) {
      validatedCustomWebsites = customWebsites.filter((ws: any) => {
        return (
          ws &&
          typeof ws === 'object' &&
          typeof ws.name === 'string' &&
          ws.name.trim().length > 0 &&
          typeof ws.enabled === 'boolean' &&
          ws.config &&
          typeof ws.config === 'object' &&
          ws.config.type === 'html'
        )
      }).map((ws: any) => ({
        id: ws.id || `website-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: ws.name.trim(),
        enabled: ws.enabled,
        config: ws.config,
      }))
    } else if (customWebsites === null || customWebsites === undefined) {
      validatedCustomWebsites = null
    }

    const keywordGroup = await prisma.keywordGroup.update({
      where: { id: params.id },
      data: {
        name,
        words: words || [],
        requiredWords: requiredWords || [],
        excludedWords: excludedWords || [],
        priority: priority ?? 0,
        enabled: enabled ?? true,
        customWebsites: validatedCustomWebsites && validatedCustomWebsites.length > 0 
          ? validatedCustomWebsites 
          : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: keywordGroup,
    })
  } catch (error) {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.keywordGroup.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      data: { message: '关键词组已删除' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

