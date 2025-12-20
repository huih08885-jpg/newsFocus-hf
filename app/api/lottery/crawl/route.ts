import { NextRequest, NextResponse } from 'next/server'
import { LotteryCrawler } from '@/lib/services/lottery-crawler'
import { LotteryCrawlerPuppeteer } from '@/lib/services/lottery-crawler-puppeteer'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'

/**
 * 爬取福利彩票开奖结果
 * POST /api/lottery/crawl
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { mode = "latest", startDate, endDate, maxPages = 1000, usePuppeteer = true } = body

    logger.info('收到福利彩票爬取请求', 'LotteryAPI', { mode, maxPages, startDate, endDate, usePuppeteer })

    // 根据模式确定日期范围
    let actualStartDate: Date | undefined
    let actualEndDate: Date | undefined

    if (mode === "latest") {
      // 最新爬取：从数据库中最新的记录之后开始
      const latestRecord = await prisma.lotteryResult.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true }
      })

      if (latestRecord) {
        // 从最新记录的下一天开始爬取
        actualStartDate = new Date(latestRecord.date)
        actualStartDate.setDate(actualStartDate.getDate() + 1)
        actualEndDate = new Date() // 到今天为止
        logger.info(`最新爬取模式：从 ${actualStartDate.toISOString().split('T')[0]} 开始`, 'LotteryAPI', {
          latestRecordDate: latestRecord.date,
          startDate: actualStartDate.toISOString().split('T')[0],
          endDate: actualEndDate.toISOString().split('T')[0]
        })
      } else {
        // 数据库为空，默认爬取近5年
        actualEndDate = new Date()
        actualStartDate = new Date()
        actualStartDate.setFullYear(actualStartDate.getFullYear() - 5)
        logger.info('数据库为空，默认爬取近5年', 'LotteryAPI', {
          startDate: actualStartDate.toISOString().split('T')[0],
          endDate: actualEndDate.toISOString().split('T')[0]
        })
      }
    } else if (mode === "custom") {
      // 自定义时间段
      if (!startDate || !endDate) {
        return NextResponse.json(
          {
            success: false,
            error: '自定义时间段模式需要提供 startDate 和 endDate',
          },
          { status: 400 }
        )
      }
      actualStartDate = new Date(startDate)
      actualEndDate = new Date(endDate)
      logger.info(`自定义时间段模式：${actualStartDate.toISOString().split('T')[0]} 至 ${actualEndDate.toISOString().split('T')[0]}`, 'LotteryAPI')
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的爬取模式: ${mode}，支持的模式: latest, custom`,
        },
        { status: 400 }
      )
    }

    // 根据参数选择使用 Puppeteer 或普通爬虫
    let result
    if (usePuppeteer) {
      try {
        const crawler = new LotteryCrawlerPuppeteer(prisma)
        result = await crawler.crawl({
          startDate: actualStartDate,
          endDate: actualEndDate,
          maxPages,
          onProgress: (progress) => {
            logger.info('爬取进度', 'LotteryAPI.Progress', progress)
          }
        })
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        // 如果 Puppeteer 未安装或失败，回退到普通爬虫
        if (errorObj.message.includes('Puppeteer') || errorObj.message.includes('puppeteer')) {
          logger.warn('Puppeteer 不可用，回退到普通爬虫', 'LotteryAPI', { error: errorObj.message })
          const crawler = new LotteryCrawler()
          result = await crawler.crawl({
            startDate: actualStartDate,
            endDate: actualEndDate,
            maxPages,
          })
        } else {
          throw error
        }
      }
    } else {
      const crawler = new LotteryCrawler()
      result = await crawler.crawl({
        startDate: actualStartDate,
        endDate: actualEndDate,
        maxPages,
      })
    }

    logger.info('爬虫执行完成，检查结果', 'LotteryAPI', {
      success: result.success,
      hasData: !!result.data,
      dataLength: result.data?.length || 0,
      total: result.total,
      error: result.error
    })

    if (!result.success) {
      logger.error('爬虫执行失败', 
        result.error ? new Error(result.error) : new Error('未知错误'), 
        'LotteryAPI', 
        {
          error: result.error,
          result: JSON.stringify(result, null, 2)
        }
      )
      return NextResponse.json(
        {
          success: false,
          error: result.error || '爬取失败',
        },
        { status: 500 }
      )
    }

    if (!result.data || result.data.length === 0) {
      logger.warn('爬虫返回空数据', 'LotteryAPI', {
        result: JSON.stringify(result, null, 2)
      })
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          saved: 0,
          skipped: 0,
          actualCount: 0,
          message: '爬虫未获取到数据',
        },
      })
    }

    // 打印获取到的数据（用于调试）
    if (result.data && result.data.length > 0) {
      logger.info(`获取到 ${result.data.length} 条数据，开始打印前5条数据详情`, 'LotteryAPI', {
        total: result.data.length,
        firstItem: result.data[0] ? JSON.stringify(result.data[0], null, 2) : 'N/A'
      })
      
      // 打印前5条数据的详细信息
      result.data.slice(0, 5).forEach((item, index) => {
        logger.info(`数据 ${index + 1}/${result.data.length}`, 'LotteryAPI.Data', {
          period: item.period,
          date: item.date,
          redBalls: item.redBalls,
          blueBall: item.blueBall,
          url: item.url
        })
      })
    }

    // 如果使用 Puppeteer，数据已经在爬取时保存了，不需要再次保存
    // 如果使用普通爬虫，需要保存数据
    // 类型守卫：检查 result 是否有 saved 属性（Puppeteer 爬虫）
    const isPuppeteerResult = 'saved' in result || 'existing' in result || 'skipped' in result
    let savedCount = isPuppeteerResult ? (result as any).saved || (result as any).total || 0 : 0 // 新保存的数量
    let existingCount = isPuppeteerResult ? (result as any).existing || 0 : 0 // 已存在的数量
    let skippedCount = isPuppeteerResult ? (result as any).skipped || 0 : 0 // 跳过（无效）的数量

    if (!usePuppeteer && result.data && result.data.length > 0) {
      // 普通爬虫需要保存数据
      logger.info(`开始保存 ${result.data.length} 条数据到数据库`, 'LotteryAPI', {
        total: result.data.length
      })

      savedCount = 0
      skippedCount = 0
      const errors: Array<{ period: string; error: string }> = []

      for (const item of result.data) {
        try {
          // 验证数据
          if (!item.period || !item.date || !item.redBalls || item.redBalls.length < 6 || !item.blueBall) {
            skippedCount++
            continue
          }

          // 验证日期格式
          let dateObj: Date
          try {
            dateObj = new Date(item.date)
            if (isNaN(dateObj.getTime())) {
              skippedCount++
              continue
            }
          } catch (e) {
            skippedCount++
            continue
          }

          // 验证期号格式
          if (!/^\d{7}$/.test(item.period)) {
            skippedCount++
            continue
          }

          // 检查是否已存在
          const existing = await prisma.lotteryResult.findUnique({
            where: { period: item.period },
          })

          if (existing) {
            await prisma.lotteryResult.update({
              where: { period: item.period },
              data: {
                date: dateObj,
                redBalls: item.redBalls,
                blueBall: item.blueBall,
                url: item.url,
                metadata: item.metadata || {},
              },
            })
            savedCount++
          } else {
            await prisma.lotteryResult.create({
              data: {
                period: item.period,
                date: dateObj,
                redBalls: item.redBalls,
                blueBall: item.blueBall,
                url: item.url,
                metadata: item.metadata || {},
              },
            })
            savedCount++
          }
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          logger.error(`保存开奖结果失败: ${item.period}`, errorObj, 'LotteryAPI', {
            period: item.period
          })
          errors.push({ period: item.period, error: errorObj.message })
          skippedCount++
        }
      }
    }

    // 验证数据库中的实际记录数
    const actualCount = await prisma.lotteryResult.count()
    logger.info('福利彩票爬取完成', 'LotteryAPI', {
      total: result.total,
      saved: savedCount,
      existing: existingCount,
      skipped: skippedCount,
      actualCount,
      usePuppeteer
    })

    return NextResponse.json({
      success: true,
      data: {
        total: result.total,
        saved: savedCount,
        existing: existingCount,
        skipped: skippedCount,
        actualCount,
        results: result.data?.slice(0, 10) || [], // 只返回前10条结果（避免响应过大）
      },
    })
  } catch (error) {
    return handleError(error, 'LotteryAPI', '福利彩票爬取失败')
  }
}

/**
 * 获取开奖结果列表
 * GET /api/lottery/crawl?limit=50&offset=0&startDate=2020-01-01&endDate=2024-12-31
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const offset = Number(searchParams.get('offset') || 0)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period')

    const where: any = {}

    if (period) {
      where.period = period
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
      }
    }

    const [results, total] = await Promise.all([
      prisma.lotteryResult.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.lotteryResult.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        results,
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    return handleError(error, 'LotteryAPI', '获取开奖结果失败')
  }
}

