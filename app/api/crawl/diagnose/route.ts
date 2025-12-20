import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MatcherService } from '@/lib/services/matcher'

/**
 * 诊断关键词匹配问题
 * GET /api/crawl/diagnose?keywordGroupId=xxx
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams
    const keywordGroupId = searchParams.get('keywordGroupId')

    const diagnosis: any = {
      keywordGroups: [],
      recentNews: [],
      matchResults: [],
      issues: [],
    }

    // 1. 检查关键词组配置
    const keywordGroups = await prisma.keywordGroup.findMany({
      where: keywordGroupId ? { id: keywordGroupId } : { enabled: true },
      orderBy: { priority: 'asc' },
    })

    diagnosis.keywordGroups = keywordGroups.map((kg) => ({
      id: kg.id,
      name: kg.name,
      words: kg.words,
      requiredWords: kg.requiredWords,
      excludedWords: kg.excludedWords,
      enabled: kg.enabled,
      priority: kg.priority,
      issues: [],
    }))

    // 检查关键词组配置问题
    for (const kg of diagnosis.keywordGroups) {
      if (!kg.enabled) {
        kg.issues.push('关键词组未启用')
      }
      if (kg.words.length === 0) {
        kg.issues.push('没有配置普通词')
      }
      if (kg.words.some((w: string) => !w || w.trim().length === 0)) {
        kg.issues.push('存在空的关键词')
      }
    }

    // 2. 获取最近的新闻（最近1小时）
    const recentNews = await prisma.newsItem.findMany({
      where: {
        crawledAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 最近1小时
        },
      },
      include: {
        platform: true,
        matches: {
          include: {
            keywordGroup: true,
          },
        },
      },
      orderBy: {
        crawledAt: 'desc',
      },
      take: 20,
    })

    diagnosis.recentNews = recentNews.map((news) => ({
      id: news.id,
      title: news.title,
      platform: news.platform.name,
      crawledAt: news.crawledAt,
      hasMatches: news.matches.length > 0,
      matchedGroups: news.matches.map((m) => ({
        id: m.keywordGroup.id,
        name: m.keywordGroup.name,
      })),
    }))

    // 3. 测试匹配
    const matcher = new MatcherService(prisma)
    const enabledGroups = await matcher.getEnabledKeywordGroups()

    for (const news of recentNews.slice(0, 10)) {
      // 测试每个关键词组
      for (const group of enabledGroups) {
        const result = matcher.testKeywordGroup(news.title, group)
        if (result.matched) {
          diagnosis.matchResults.push({
            newsId: news.id,
            newsTitle: news.title,
            keywordGroupId: group.id,
            keywordGroupName: group.name,
            matchedWords: result.matchedWords,
            alreadyMatched: news.matches.some(
              (m) => m.keywordGroupId === group.id
            ),
          })
        }
      }
    }

    // 4. 检查常见问题
    if (enabledGroups.length === 0) {
      diagnosis.issues.push('没有启用的关键词组')
    }

    if (recentNews.length === 0) {
      diagnosis.issues.push('最近1小时内没有爬取到新闻')
    }

    const matchedNewsCount = recentNews.filter((n) => n.matches.length > 0).length
    if (matchedNewsCount === 0 && recentNews.length > 0) {
      diagnosis.issues.push(
        `最近爬取的 ${recentNews.length} 条新闻中，没有一条匹配到关键词组`
      )
    }

    // 5. 检查是否有未匹配的新闻应该匹配
    const unmatchedButShouldMatch = diagnosis.matchResults.filter(
      (r: any) => !r.alreadyMatched
    )
    if (unmatchedButShouldMatch.length > 0) {
      diagnosis.issues.push(
        `发现 ${unmatchedButShouldMatch.length} 条新闻应该匹配但未匹配（可能是实时匹配未启用）`
      )
    }

    return NextResponse.json({
      success: true,
      data: diagnosis,
    })
  } catch (error) {
    console.error('Error diagnosing:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DIAGNOSE_ERROR',
          message: error instanceof Error ? error.message : '诊断失败',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

