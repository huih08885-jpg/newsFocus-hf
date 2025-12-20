import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MatcherService } from '@/lib/services/matcher'

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 预览爬取结果
 * POST /api/crawl/preview
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
    const { platforms, keywordGroupIds } = body

    // 如果指定了关键词组，说明要使用搜索模式
    // 预览功能基于历史数据，所以仍然使用匹配模式预览
    // 但会提示用户：搜索模式下会获取更多相关结果
    
    // 获取最近24小时的新闻（用于预览）
    const recentNews = await prisma.newsItem.findMany({
      where: {
        crawledAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
        },
        ...(platforms && platforms.length > 0 && {
          platformId: { in: platforms },
        }),
      },
      include: {
        platform: true,
      },
      take: 1000, // 限制预览数量
    })

    const matcher = new MatcherService(prisma)
    
    // 获取要匹配的关键词组
    let keywordGroups = await matcher.getEnabledKeywordGroups()
    
    // 如果指定了关键词组ID，只匹配这些组
    if (keywordGroupIds && keywordGroupIds.length > 0) {
      keywordGroups = keywordGroups.filter(g => keywordGroupIds.includes(g.id))
    }

    if (keywordGroups.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalNews: recentNews.length,
          matchedNews: 0,
          matchRate: 0,
          matchesByKeywordGroup: [],
          matchesByPlatform: [],
        },
      })
    }

    // 匹配新闻
    const matches = await matcher.matchNewsItems(
      recentNews.map((n) => ({ id: n.id, title: n.title }))
    )

    // 统计匹配结果
    const matchesByKeywordGroup = new Map<string, { name: string; count: number }>()
    const matchesByPlatform = new Map<string, { name: string; count: number }>()

    for (const [newsId, matchedGroups] of matches.entries()) {
      const newsItem = recentNews.find((n) => n.id === newsId)
      if (!newsItem) continue

      // 统计关键词组匹配
      for (const group of matchedGroups) {
        const groupName = group.name || '未命名'
        const current = matchesByKeywordGroup.get(group.id) || { name: groupName, count: 0 }
        matchesByKeywordGroup.set(group.id, { name: groupName, count: current.count + 1 })
      }

      // 统计平台匹配
      const platformName = newsItem.platform.name
      const current = matchesByPlatform.get(newsItem.platformId) || { name: platformName, count: 0 }
      matchesByPlatform.set(newsItem.platformId, { name: platformName, count: current.count + 1 })
    }

    const matchedNewsCount = matches.size
    const matchRate = recentNews.length > 0 ? matchedNewsCount / recentNews.length : 0

    // 如果指定了关键词组，提示将使用搜索模式
    const useSearchMode = keywordGroupIds && keywordGroupIds.length > 0

    return NextResponse.json({
      success: true,
      data: {
        totalNews: recentNews.length,
        matchedNews: matchedNewsCount,
        matchRate: Math.round(matchRate * 100) / 100,
        matchesByKeywordGroup: Array.from(matchesByKeywordGroup.values()),
        matchesByPlatform: Array.from(matchesByPlatform.values()),
        note: useSearchMode 
          ? '预览基于历史数据匹配。实际爬取时将使用关键词搜索模式，会获取更多相关结果。'
          : '预览基于历史数据匹配。',
      },
    })
  } catch (error) {
    console.error('Error previewing crawl:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PREVIEW_ERROR',
          message: error instanceof Error ? error.message : '预览失败',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

