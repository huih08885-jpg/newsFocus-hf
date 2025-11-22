import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { CrawlerService } from '@/lib/services/crawler'
import { MatcherService } from '@/lib/services/matcher'
import { CalculatorService } from '@/lib/services/calculator'

export async function GET(request: NextRequest) {
  // 验证Cron Secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[定时任务] 开始执行爬取任务...')
    
    // 创建爬取任务
    const task = await prisma.crawlTask.create({
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    // 执行爬取
    const crawler = new CrawlerService(prisma)
    const result = await crawler.crawlAllPlatforms()

    console.log(`[定时任务] 爬取完成: 成功 ${result.successCount} 个平台, 失败 ${result.failedCount} 个平台`)

    // 执行关键词匹配和权重计算（如果有成功的平台）
    let matchedNewsCount = 0
    if (result.successCount > 0) {
      console.log('[定时任务] 开始执行关键词匹配...')
      const matcher = new MatcherService(prisma)
      const calculator = new CalculatorService()

      // 获取最新爬取的新闻（最近1小时）
      const recentNews = await prisma.newsItem.findMany({
        where: {
          crawledAt: {
            gte: new Date(Date.now() - 3600000),
          },
        },
        include: {
          platform: true,
        },
      })

      console.log(`[定时任务] 找到 ${recentNews.length} 条最近1小时的新闻`)

      // 匹配关键词
      const matches = await matcher.matchNewsItems(
        recentNews.map((n) => ({ id: n.id, title: n.title }))
      )
      
      matchedNewsCount = matches.size
      console.log(`[定时任务] 匹配到 ${matchedNewsCount} 条新闻`)

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
          const weight = calculator.calculateWeight({
            ranks: appearances.map((a) => a.rank).concat([newsItem.rank]),
            matchCount: 1,
            appearances: appearances.concat([
              {
                rank: newsItem.rank,
                appearedAt: newsItem.crawledAt,
              },
            ]),
          })

          // 创建或更新匹配记录
          await prisma.newsMatch.upsert({
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
          const matchRecord = await prisma.newsMatch.findUnique({
            where: {
              newsItemId_keywordGroupId: {
                newsItemId: newsId,
                keywordGroupId: keywordGroup.id,
              },
            },
          })

          if (matchRecord) {
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
    }

    // 更新任务状态
    await prisma.crawlTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
    })

    console.log(`[定时任务] 完成: 匹配到 ${matchedNewsCount} 条新闻`)

    return NextResponse.json({
      success: true,
      message: 'Crawl task completed',
      data: {
        ...result,
        matchedNewsCount,
      },
    })
  } catch (error) {
    console.error('[定时任务] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

