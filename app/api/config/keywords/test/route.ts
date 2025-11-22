import { NextRequest, NextResponse } from 'next/server'
import { MatcherService } from '@/lib/services/matcher'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, keywordGroupId } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '测试文本不能为空',
          },
        },
        { status: 400 }
      )
    }

    if (!keywordGroupId || typeof keywordGroupId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '关键词组ID不能为空',
          },
        },
        { status: 400 }
      )
    }

    // 获取指定的关键词组
    const keywordGroup = await prisma.keywordGroup.findUnique({
      where: { id: keywordGroupId },
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

    // 使用匹配服务测试
    const matcher = new MatcherService(prisma)
    const result = matcher.testKeywordGroup(title, {
      id: keywordGroup.id,
      name: keywordGroup.name,
      words: keywordGroup.words,
      requiredWords: keywordGroup.requiredWords,
      excludedWords: keywordGroup.excludedWords,
      priority: keywordGroup.priority,
      enabled: keywordGroup.enabled,
    })

    return NextResponse.json({
      success: true,
      data: {
        matched: result.matched,
        matchedWords: result.matchedWords || [],
        keywordGroup: {
          id: keywordGroup.id,
          name: keywordGroup.name,
          words: keywordGroup.words,
          requiredWords: keywordGroup.requiredWords,
          excludedWords: keywordGroup.excludedWords,
          priority: keywordGroup.priority,
        },
        testTitle: title,
      },
    })
  } catch (error) {
    console.error('测试关键词匹配失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '测试失败',
        },
      },
      { status: 500 }
    )
  }
}

