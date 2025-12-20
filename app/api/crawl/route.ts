import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { CrawlerService } from '@/lib/services/crawler'
import { MatcherService } from '@/lib/services/matcher'
import { CalculatorService } from '@/lib/services/calculator'
import { getCurrentUser } from '@/lib/auth'
import { cleanupCrawlTasks } from '@/lib/services/crawl-task-manager'

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 手动触发爬取
 * POST /api/crawl
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
    console.log('[Crawl API] 收到爬取请求')
    const body = await request.json()
    const { platforms, force, keywordGroupIds, keywords, enableRealtimeMatching, useWebSearch } = body
    console.log('[Crawl API] 请求参数:', { platforms, force, keywordGroupIds, keywords, enableRealtimeMatching, useWebSearch })

    const currentUser = await getCurrentUser()

    // 自动清理运行超时的任务（防止任务卡住）
    const autoCleanup = await cleanupCrawlTasks(prisma, {
      olderThanMinutes: 15,
      reason: '自动清理：任务超过15分钟仍在运行',
    })
    if (autoCleanup.cleanedCount > 0) {
      console.log(`[Crawl API] 自动清理 ${autoCleanup.cleanedCount} 个超时任务`)
    }

    // 业务逻辑验证：检查是否有正在进行的爬取任务
    if (!force) {
      console.log('[Crawl API] 检查是否有正在进行的爬取任务...')
      try {
        const runningTask = await prisma.crawlTask.findFirst({
          where: {
            status: {
              in: ['pending', 'running'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        if (runningTask) {
          console.log('[Crawl API] 发现正在进行的任务:', runningTask.id, runningTask.status)
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'TASK_RUNNING',
                message: '已有爬取任务正在进行中，请等待完成或使用 force=true 强制执行',
                details: {
                  taskId: runningTask.id,
                  status: runningTask.status,
                  startedAt: runningTask.startedAt,
                },
              },
            },
            { status: 409 }
          )
        }
        console.log('[Crawl API] 没有正在进行的任务，可以开始新的爬取')
      } catch (dbError) {
        console.error('[Crawl API] 数据库查询错误:', dbError)
        throw dbError
      }
    } else {
      console.log('[Crawl API] 使用 force=true，跳过任务检查')
    }

    // 业务逻辑验证：验证平台是否存在且启用
    // 如果使用全网搜索，自动创建或启用 web-search 平台
    if (useWebSearch) {
      await prisma.platform.upsert({
        where: { platformId: 'web-search' },
        update: { enabled: true },
        create: {
          platformId: 'web-search',
          name: '全网搜索',
          enabled: true,
        },
      })
    }

    if (platforms && platforms.length > 0) {
      const validPlatforms = await prisma.platform.findMany({
        where: {
          platformId: { in: platforms },
          enabled: true,
        },
      })

      if (validPlatforms.length !== platforms.length) {
        const invalidPlatforms = platforms.filter(
          (p: string) => !validPlatforms.some((vp) => vp.platformId === p)
        )
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_PLATFORMS',
              message: `以下平台不存在或未启用: ${invalidPlatforms.join(', ')}`,
              details: {
                invalidPlatforms,
                validPlatforms: validPlatforms.map((p) => p.platformId),
              },
            },
          },
          { status: 400 }
        )
      }
    }

    // 创建爬取任务记录
    console.log('[Crawl API] 创建新的爬取任务...')
    const task = await prisma.crawlTask.create({
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })
    console.log('[Crawl API] 爬取任务已创建，taskId:', task.id)

    // 立即返回taskId，让前端可以开始轮询进度
    // 爬取过程在后台异步执行
    const response = NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
      },
    })

    // 异步执行爬取，不阻塞响应
    ;(async () => {
      try {
        console.log('[Crawl API] 开始异步爬取任务，taskId:', task.id)
        console.log('[Crawl API] 配置:', {
          platforms,
          keywordGroupIds,
          enableRealtimeMatching,
        })
        
        // 获取平台总数（用于进度计算）
        const allPlatforms = await prisma.platform.findMany({
          where: platforms && platforms.length > 0
            ? { platformId: { in: platforms }, enabled: true }
            : { enabled: true },
        })
        const totalPlatforms = allPlatforms.length

        // 获取关键词组信息（如果指定了关键词组ID）
        let keywordGroups: Array<{ id: string; words: string[] }> | undefined
        let customKeywordsList: string[] | undefined
        let isCustomKeywordsMode = false
        
        if (keywords && keywords.length > 0) {
          // 使用自定义关键词
          customKeywordsList = keywords
          isCustomKeywordsMode = true
          console.log('[Crawl API] 使用自定义关键词搜索模式，关键词:', customKeywordsList.join(', '))
        } else if (keywordGroupIds && keywordGroupIds.length > 0) {
          // 使用关键词组
          const groups = await prisma.keywordGroup.findMany({
            where: {
              id: { in: keywordGroupIds },
              enabled: true,
            },
            select: {
              id: true,
              words: true,
            },
          })
          keywordGroups = groups.map(g => ({
            id: g.id,
            words: g.words,
          }))
          // 提取所有关键词组的关键词，合并为关键词列表
          customKeywordsList = groups.flatMap(g => g.words)
          console.log('[Crawl API] 使用关键词组搜索模式，关键词组:', keywordGroups.map(g => g.id).join(', '))
          console.log('[Crawl API] 提取的关键词:', customKeywordsList.join(', '))
        }

        // 执行爬取（带进度回调）
        const crawler = new CrawlerService(prisma, {
          requestInterval: 1000,
          enableRealtimeMatching: enableRealtimeMatching ?? false, // 默认关闭实时匹配，保持向后兼容
          userId: currentUser?.id,
        })
        
        let crawlProgress = {
          currentStep: 'crawling' as const,
          totalPlatforms,
          completedPlatforms: 0,
          currentPlatform: '',
          successCount: 0,
          failedCount: 0,
          fetchedNewsCount: 0,
        }

        const result = await crawler.crawlAllPlatforms(platforms, (progress) => {
          crawlProgress = {
            currentStep: 'crawling',
            totalPlatforms: progress.total,
            completedPlatforms: progress.current,
            currentPlatform: progress.currentPlatform,
            successCount: progress.successCount,
            failedCount: progress.failedCount,
            fetchedNewsCount: progress.fetchedNewsCount,
          }
          
          // 更新任务进度（使用errorMessage字段存储JSON格式的进度数据）
          prisma.crawlTask.update({
            where: { id: task.id },
            data: {
              successCount: progress.successCount,
              failedCount: progress.failedCount,
              errorMessage: JSON.stringify({
                ...crawlProgress,
                failedPlatforms: progress.failedPlatforms || [],
              }),
          },
        }).catch(console.error)
        }, keywordGroupIds, keywordGroups, customKeywordsList, isCustomKeywordsMode) // 传递关键词组ID、关键词组信息、自定义关键词和模式标记

        // 如果启用了实时匹配，就不需要批量匹配了
        let matchedNewsCount = 0
        if (!enableRealtimeMatching && result.successCount > 0) {
          // 更新进度：开始匹配阶段
          await prisma.crawlTask.update({
            where: { id: task.id },
            data: {
              errorMessage: JSON.stringify({
                ...crawlProgress,
                currentStep: 'matching',
                matchedNews: 0,
              }),
            },
          })

          // 执行关键词匹配和权重计算（批量匹配模式）
          const matcher = new MatcherService(prisma)
          const calculator = new CalculatorService()

          // 获取最新爬取的新闻
          const recentNews = await prisma.newsItem.findMany({
            where: {
              crawledAt: {
                gte: new Date(Date.now() - 3600000), // 最近1小时
              },
            },
            include: {
              platform: true,
            },
          })

          // 获取要匹配的关键词组
          let keywordGroups = await matcher.getEnabledKeywordGroups()
          
          // 如果指定了关键词组ID，只匹配这些组
          if (keywordGroupIds && keywordGroupIds.length > 0) {
            keywordGroups = keywordGroups.filter(g => keywordGroupIds.includes(g.id))
          }

          // 匹配关键词
          const matches = await matcher.matchNewsItems(
            recentNews.map((n) => ({ id: n.id, title: n.title }))
          )
          
          matchedNewsCount = matches.size

          // 处理匹配结果
          for (const [newsId, keywordGroups] of matches.entries()) {
            const newsItem = recentNews.find((n) => n.id === newsId)
            if (!newsItem) continue

            // 获取新闻的出现记录
            const appearances = await prisma.newsAppearance.findMany({
              where: { newsItemId: newsId },
            })

            for (const keywordGroup of keywordGroups) {
              // 计算权重
              const appearanceData = appearances.map((a) => ({
                rank: a.rank,
                appearedAt: a.appearedAt,
              }))
              
              const weight = calculator.calculateWeight({
                ranks: appearanceData.map((a) => a.rank).concat([newsItem.rank]),
                matchCount: 1,
                appearances: appearanceData.concat([
                  {
                    rank: newsItem.rank,
                    appearedAt: newsItem.crawledAt,
                  },
                ]),
              })

              // 创建或更新匹配记录
              const matchRecord = await prisma.newsMatch.upsert({
                where: {
                  newsItemId_keywordGroupId: {
                    newsItemId: newsId,
                    keywordGroupId: keywordGroup.id,
                  },
                },
                update: {
                  weight,
                  matchCount: { increment: 1 },
                  lastMatchedAt: new Date(),
                },
                create: {
                  newsItemId: newsId,
                  keywordGroupId: keywordGroup.id,
                  weight,
                  matchCount: 1,
                  firstMatchedAt: new Date(),
                  lastMatchedAt: new Date(),
                },
              })

              // 创建出现记录（关联到匹配记录）
              await prisma.newsAppearance.create({
                data: {
                  newsItemId: newsId,
                  matchId: matchRecord.id,
                  rank: newsItem.rank,
                  appearedAt: newsItem.crawledAt,
                },
              })
            }
          }
        }

        // 收集失败平台的错误信息
        const failedPlatforms: Array<{ platformId: string; error: string }> = []
        result.results.forEach((r) => {
          if (!r.success && r.error) {
            failedPlatforms.push({
              platformId: r.platformId,
              error: r.error,
            })
          }
        })

        // 更新任务状态
        await prisma.crawlTask.update({
          where: { id: task.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            successCount: result.successCount,
            failedCount: result.failedCount,
            errorMessage: JSON.stringify({
              currentStep: 'completed',
              totalPlatforms,
              completedPlatforms: totalPlatforms,
              successCount: result.successCount,
              failedCount: result.failedCount,
              matchedNews: matchedNewsCount,
              failedPlatforms,
            }),
          },
        })
      } catch (error) {
        const { logger } = await import('@/lib/utils/logger')
        logger.error('异步爬取任务执行失败', error instanceof Error ? error : new Error(String(error)), 'CrawlAPI', { taskId: task.id })
        
        // 更新任务状态为失败
        await prisma.crawlTask.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        }).catch((updateError) => {
          logger.error('更新任务状态失败', updateError instanceof Error ? updateError : new Error(String(updateError)), 'CrawlAPI', { taskId: task.id })
        })
      }
    })()

    return response
  } catch (error) {
    const { handleError } = await import('@/lib/utils/error-handler')
    return handleError(error, 'CrawlAPI', '创建爬取任务失败')
  }
  ========== 原始代码结束 ========== */
}

/**
 * ========== 已注释：爬虫管理模块相关API ==========
 * 获取爬取任务状态
 * GET /api/crawl
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
    const taskId = searchParams.get('taskId')

    if (taskId) {
      const task = await prisma.crawlTask.findUnique({
        where: { id: taskId },
      })

      if (!task) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found',
            },
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: task,
      })
    }

    // 返回最新任务
    const latestTask = await prisma.crawlTask.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: latestTask || null,
    })
  } catch (error) {
    console.error('Error fetching crawl status:', error)
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
  ========== 原始代码结束 ========== */
}
