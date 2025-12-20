import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const keywordGroups = await prisma.keywordGroup.findMany({
      orderBy: { priority: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        items: keywordGroups,
        total: keywordGroups.length,
      },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, words, requiredWords, excludedWords, priority, enabled, customWebsites } = body

    // 业务逻辑验证：至少需要一个普通词
    const validWords = (words || []).filter((w: string) => w.trim().length > 0)
    if (validWords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '至少需要一个普通词',
          },
        },
        { status: 400 }
      )
    }

    // 业务逻辑验证：过滤重复词
    const uniqueWords = [...new Set(validWords)]
    const uniqueRequiredWords = [
      ...new Set((requiredWords || []).filter((w: string) => w.trim().length > 0)),
    ]
    const uniqueExcludedWords = [
      ...new Set((excludedWords || []).filter((w: string) => w.trim().length > 0)),
    ]

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
    }

    const keywordGroup = await prisma.keywordGroup.create({
      data: {
        name: name?.trim() || null,
        words: uniqueWords,
        requiredWords: uniqueRequiredWords,
        excludedWords: uniqueExcludedWords,
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
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

