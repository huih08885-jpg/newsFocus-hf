import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { CrawlerService } from '@/lib/services/crawler'
import { MatcherService } from '@/lib/services/matcher'
import { CalculatorService } from '@/lib/services/calculator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platforms, force } = body

    // 创建爬取任务记录
    const task = await prisma.crawlTask.create({
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

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
        // 获取平台总数（用于进度计算）
        const allPlatforms = await prisma.platform.findMany({
          where: platforms && platforms.length > 0
            ? { platformId: { in: platforms }, enabled: true }
            : { enabled: true },
        })
        const totalPlatforms = allPlatforms.length

        // 执行爬取（带进度回调）
        const crawler = new CrawlerService(prisma, {
          requestInterval: 1000,
        })
        
        let crawlProgress = {
          currentStep: 'crawling' as const,
          totalPlatforms,
          completedPlatforms: 0,
          currentPlatform: '',
          successCount: 0,
          failedCount: 0,
        }

        const result = await crawler.crawlAllPlatforms(platforms, (progress) => {
          crawlProgress = {
            currentStep: 'crawling',
            totalPlatforms: progress.total,
            completedPlatforms: progress.current,
            currentPlatform: progress.currentPlatform,
            successCount: progress.successCount,
            failedCount: progress.failedCount,
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
        })

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

        // 执行关键词匹配和权重计算
        let matchedNewsCount = 0
        // 即使部分平台失败，只要有成功的就执行匹配
        if (result.successCount > 0) {
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
        console.error('Error in async crawl task:', error)
        // 更新任务状态为失败
        await prisma.crawlTask.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        }).catch(console.error)
      }
    })()

    return response
  } catch (error) {
    console.error('Error creating crawl task:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CRAWL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
}
