import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MatcherService } from '@/lib/services/matcher'

/**
 * 测试关键词匹配功能
 * POST /api/crawl/test-match
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function POST(request: NextRequest) {
  // ========== 已注释：爬虫管理模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '爬虫管理模块已禁用',
      },
    },
    { status: 503 }
  )
  
  /* ========== 原始代码已注释 ==========
  try {
    const body = await request.json()
    const { title, keywordGroupId } = body

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TITLE',
            message: '请提供新闻标题',
          },
        },
        { status: 400 }
      )
    }

    const matcher = new MatcherService(prisma)

    // 如果指定了关键词组ID，只测试该组
    if (keywordGroupId) {
      const keywordGroup = await prisma.keywordGroup.findUnique({
        where: { id: keywordGroupId },
      })

      if (!keywordGroup) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'KEYWORD_GROUP_NOT_FOUND',
              message: '关键词组不存在',
            },
          },
          { status: 404 }
        )
      }

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
          title,
          keywordGroup: {
            id: keywordGroup.id,
            name: keywordGroup.name,
            words: keywordGroup.words,
            requiredWords: keywordGroup.requiredWords,
            excludedWords: keywordGroup.excludedWords,
          },
          matched: result.matched,
          matchedWords: result.matchedWords || [],
          details: {
            titleLower: title.toLowerCase(),
            wordsLower: keywordGroup.words.map((w) => w.toLowerCase()),
            matchedWordsLower: (result.matchedWords || []).map((w) => w.toLowerCase()),
          },
        },
      })
    }

    // 测试所有启用的关键词组
    const result = await matcher.matchTitle(title)
    const allGroups = await matcher.getEnabledKeywordGroups()

    return NextResponse.json({
      success: true,
      data: {
        title,
        matched: result?.matched || false,
        matchedKeywordGroup: result?.keywordGroup
          ? {
              id: result.keywordGroup.id,
              name: result.keywordGroup.name,
              words: result.keywordGroup.words,
            }
          : null,
        matchedWords: result?.matchedWords || [],
        allEnabledGroups: allGroups.map((g) => ({
          id: g.id,
          name: g.name,
          words: g.words,
          enabled: g.enabled,
        })),
      },
    })
  } catch (error) {
    console.error('Error testing match:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: error instanceof Error ? error.message : '测试失败',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

