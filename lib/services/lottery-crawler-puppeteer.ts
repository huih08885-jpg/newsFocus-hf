/**
 * 中国福利彩票开奖结果爬虫（Puppeteer 版本）
 * 使用 Puppeteer 执行 JavaScript 并获取动态加载的数据
 */

import { logger } from '@/lib/utils/logger'
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export interface LotteryResult {
  period: string // 期号
  date: string // 开奖日期
  redBalls: string[] // 红球号码
  blueBall: string // 蓝球号码
  url?: string // 详情页URL
  metadata?: any // 其他元数据
}

export interface CrawlOptions {
  years?: number // 爬取多少年的数据，默认5年
  startDate?: Date // 开始日期
  endDate?: Date // 结束日期
  maxPages?: number // 最大页数限制
  onProgress?: (progress: { saved: number; skipped: number; current: number; total: number }) => void // 进度回调
}

export class LotteryCrawlerPuppeteer {
  private baseUrl = 'https://www.cwl.gov.cn/ygkj/wqkjgg/'
  private prisma: PrismaClient

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma
  }

  /**
   * 爬取开奖结果
   */
  async crawl(options: CrawlOptions = {}): Promise<{
    success: boolean
    data: LotteryResult[]
    total: number
    saved?: number
    existing?: number
    skipped?: number
    extracted?: number
    error?: string
  }> {
    const { years = 5, startDate, endDate, maxPages = 1000 } = options

    let browser: any = null

    try {
      // 动态导入 Puppeteer（如果未安装会报错）
      const puppeteer = await import('puppeteer').catch(() => {
        throw new Error('Puppeteer 未安装，请运行: npm install puppeteer')
      })

      logger.info('开始爬取福利彩票开奖结果（Puppeteer）', 'LotteryCrawlerPuppeteer', { years, maxPages, startDate, endDate })

      // 计算日期范围
      const end = endDate || new Date()
      let start: Date
      if (startDate) {
        // 如果提供了 startDate，直接使用
        start = new Date(startDate)
      } else {
        // 如果没有提供 startDate，使用 years 参数
        start = new Date()
        start.setFullYear(start.getFullYear() - years)
      }

      logger.info(`日期范围: ${start.toISOString().split('T')[0]} 至 ${end.toISOString().split('T')[0]}`, 'LotteryCrawlerPuppeteer')

      // 启动浏览器
      logger.debug('启动 Puppeteer 浏览器', 'LotteryCrawlerPuppeteer')
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      })

      const page = await browser.newPage()

      // 设置视口和 User-Agent
      await page.setViewport({ width: 1920, height: 1080 })
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

      const results: LotteryResult[] = []
      let currentPage = 1
      let hasMore = true
      let savedCount = 0 // 新保存的数量
      let skippedCount = 0 // 跳过（已存在或无效）的数量
      let existingCount = 0 // 已存在的数量
      let totalExtracted = 0
      const allPeriods = new Set<string>() // 记录所有期号，检查重复
      let lastPageFirstPeriod = '' // 记录上一页第一行的期号，用于验证翻页

      // 爬取所有页面
      while (hasMore && currentPage <= maxPages) {
        try {
          logger.info(`正在爬取第 ${currentPage} 页 (已保存: ${savedCount}, 已存在: ${existingCount}, 跳过: ${skippedCount}, 总计提取: ${totalExtracted})`, 'LotteryCrawlerPuppeteer', { 
            currentPage, 
            savedCount,
            existingCount,
            skippedCount,
            totalExtracted,
            maxPages
          })

          const pageResults = await this.crawlPageWithPuppeteer(page, currentPage, start, end, lastPageFirstPeriod)

          logger.debug(`页面 ${currentPage} 提取结果`, 'LotteryCrawlerPuppeteer', {
            page: currentPage,
            pageResultsCount: pageResults.length,
            firstResult: pageResults[0] ? {
              period: pageResults[0].period,
              date: pageResults[0].date,
              redBalls: pageResults[0].redBalls,
              blueBall: pageResults[0].blueBall
            } : null
          })
          
          // 记录当前页第一行的期号，用于下一页验证翻页
          if (pageResults.length > 0) {
            lastPageFirstPeriod = pageResults[0].period
          }

          if (pageResults.length === 0) {
            logger.info('当前页无数据，停止爬取', 'LotteryCrawlerPuppeteer', { currentPage })
            hasMore = false
            break
          }

          // 过滤日期范围并立即保存
          let shouldStop = false // 标记是否应该停止（遇到早于开始日期的记录）
          for (const result of pageResults) {
            totalExtracted++
            const resultDate = new Date(result.date)
            
            // 检查日期是否有效
            if (isNaN(resultDate.getTime())) {
              logger.warn(`无效的日期格式: ${result.date}，期号: ${result.period}`, 'LotteryCrawlerPuppeteer', {
                period: result.period,
                date: result.date
              })
              skippedCount++
              continue
            }

            // 比较日期（只比较日期部分，忽略时间）
            const resultDateOnly = new Date(resultDate.getFullYear(), resultDate.getMonth(), resultDate.getDate())
            const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
            const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
            
            // 由于数据是按时间倒序排列的（最新的在前面），如果遇到早于开始日期的记录，
            // 说明已经超出了日期范围，应该停止爬取
            if (resultDateOnly < startDateOnly) {
              logger.info(`结果日期 ${result.date} 早于开始日期 ${start.toISOString().split('T')[0]}，停止爬取`, 'LotteryCrawlerPuppeteer', {
                resultDate: result.date,
                resultDateOnly: resultDateOnly.toISOString().split('T')[0],
                startDate: start.toISOString().split('T')[0],
                startDateOnly: startDateOnly.toISOString().split('T')[0],
                savedCount,
                existingCount,
                skippedCount,
                totalExtracted
              })
              shouldStop = true
              hasMore = false
              break // 立即停止处理当前页，因为后续数据都会更早
            }

            if (resultDateOnly > endDateOnly) {
              logger.debug(`结果日期 ${result.date} 晚于结束日期 ${end.toISOString().split('T')[0]}，跳过`, 'LotteryCrawlerPuppeteer', {
                resultDate: result.date,
                resultDateOnly: resultDateOnly.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                endDateOnly: endDateOnly.toISOString().split('T')[0]
              })
              skippedCount++
              continue
            }

            // 立即保存到数据库
            try {
              // 检查期号是否重复（在同一批次中）
              if (allPeriods.has(result.period)) {
                logger.warn(`⚠️ 期号重复（同一批次）: ${result.period}`, 'LotteryCrawlerPuppeteer', {
                  period: result.period,
                  date: result.date,
                  savedCount,
                  existingCount
                })
                skippedCount++
                continue
              }
              allPeriods.add(result.period)

              // 记录保存前的数据信息（用于调试）
              logger.debug(`准备保存: ${result.period}`, 'LotteryCrawlerPuppeteer', {
                period: result.period,
                date: result.date,
                redBalls: result.redBalls,
                blueBall: result.blueBall,
                redBallsLength: result.redBalls?.length || 0
              })

              const saveResult = await this.saveResult(result)
              
              if (saveResult.success) {
                if (saveResult.skipped) {
                  // 已存在，跳过
                  existingCount++
                  logger.debug(`已存在，跳过: ${result.period}`, 'LotteryCrawlerPuppeteer', {
                    period: result.period,
                    date: result.date,
                    existingCount,
                    savedCount
                  })
                } else {
                  // 新保存
                  savedCount++
                  results.push(result)
                  // 前100条每条都记录，之后每50条记录一次（用于调试）
                  if (savedCount <= 100 || savedCount % 50 === 0) {
                    logger.info(`✓ 已保存: ${result.period} (新保存: ${savedCount}, 已存在: ${existingCount}, 跳过: ${skippedCount}, 总计提取: ${totalExtracted})`, 'LotteryCrawlerPuppeteer', {
                      period: result.period,
                      date: result.date,
                      redBalls: result.redBalls,
                      blueBall: result.blueBall,
                      savedCount,
                      existingCount,
                      skippedCount,
                      totalExtracted
                    })
                  } else {
                    // 其他记录也记录，但用debug级别
                    logger.debug(`✓ 已保存: ${result.period}`, 'LotteryCrawlerPuppeteer', {
                      period: result.period,
                      savedCount
                    })
                  }
                }
              } else {
                skippedCount++
                logger.error(`✗ 保存失败: ${result.period}`, new Error(saveResult.error || '未知错误'), 'LotteryCrawlerPuppeteer', {
                  period: result.period,
                  date: result.date,
                  redBalls: result.redBalls,
                  blueBall: result.blueBall,
                  error: saveResult.error,
                  savedCount,
                  existingCount,
                  skippedCount,
                  totalExtracted
                })
              }
            } catch (saveError) {
              skippedCount++
              const errorObj = saveError instanceof Error ? saveError : new Error(String(saveError))
              logger.error(`✗ 保存时发生异常: ${result.period}`, errorObj, 'LotteryCrawlerPuppeteer', {
                period: result.period,
                date: result.date,
                redBalls: result.redBalls,
                blueBall: result.blueBall,
                error: errorObj.message,
                stack: errorObj.stack,
                savedCount,
                existingCount,
                skippedCount,
                totalExtracted
              })
              // 如果连续保存失败太多，记录警告
              if (skippedCount > 0 && savedCount > 0 && skippedCount / (savedCount + skippedCount) > 0.5) {
                logger.warn(`保存失败率过高 (${(skippedCount / (savedCount + skippedCount) * 100).toFixed(1)}%)，但继续尝试`, 'LotteryCrawlerPuppeteer', {
                  savedCount,
                  skippedCount,
                  failureRate: (skippedCount / (savedCount + skippedCount) * 100).toFixed(1) + '%'
                })
              }
            }

            // 每10条记录一次进度
            if ((savedCount + existingCount + skippedCount) % 10 === 0) {
              logger.info(`保存进度: 新保存 ${savedCount} 条，已存在 ${existingCount} 条，跳过 ${skippedCount} 条，总计提取 ${totalExtracted} 条`, 'LotteryCrawlerPuppeteer', {
                saved: savedCount,
                existing: existingCount,
                skipped: skippedCount,
                total: totalExtracted,
                successRate: totalExtracted > 0 ? ((savedCount / totalExtracted) * 100).toFixed(1) + '%' : '0%'
              })
              
              // 调用进度回调
              if (options.onProgress) {
                options.onProgress({
                  saved: savedCount,
                  skipped: skippedCount + existingCount, // 已存在的也算在跳过中
                  current: savedCount + existingCount + skippedCount,
                  total: totalExtracted
                })
              }
            }
          }

          // 如果遇到早于开始日期的记录，立即停止
          if (shouldStop) {
            logger.info(`日期范围已超出，停止爬取（当前页: ${currentPage}）`, 'LotteryCrawlerPuppeteer', {
              currentPage,
              savedCount,
              existingCount,
              skippedCount,
              totalExtracted
            })
            break
          }

          // 每页完成后，验证数据库中的实际记录数
          if (savedCount > 0 && (savedCount % 10 === 0 || pageResults.length < 20)) {
            try {
              const actualCount = await this.prisma.lotteryResult.count()
              logger.info(`📊 数据库验证（第 ${currentPage} 页后）: 预期保存 ${savedCount} 条，数据库实际 ${actualCount} 条`, 'LotteryCrawlerPuppeteer', {
                currentPage,
                savedCount,
                actualCount,
                difference: actualCount - savedCount,
                allPeriodsCount: allPeriods.size
              })
              
              // 如果实际数量少于预期，记录警告
              if (actualCount < savedCount) {
                logger.warn(`⚠️ 数据库记录数异常: 预期 ${savedCount} 条，实际 ${actualCount} 条，缺失 ${savedCount - actualCount} 条`, 'LotteryCrawlerPuppeteer', {
                  currentPage,
                  savedCount,
                  actualCount,
                  missing: savedCount - actualCount
                })
              }
            } catch (countError) {
              logger.warn('无法验证数据库记录数', 'LotteryCrawlerPuppeteer', {
                error: countError instanceof Error ? countError.message : String(countError)
              })
            }
          }

          if (!hasMore) {
            break
          }

          // 如果当前页所有数据都已存在，且没有新保存的数据，记录信息但继续爬取
          // 因为可能下一页会有新的数据
          if (pageResults.length > 0 && savedCount === 0 && existingCount > 0 && currentPage > 1) {
            logger.debug(`当前页所有数据都已存在，继续尝试下一页（当前页: ${currentPage}, 已存在: ${existingCount}）`, 'LotteryCrawlerPuppeteer', {
              currentPage,
              pageResultsCount: pageResults.length,
              savedCount,
              existingCount
            })
          }

          // 如果当前页结果数量较少，可能是最后一页，但不要立即停止
          // 继续尝试下一页，如果下一页没有数据，自然会停止
          if (pageResults.length < 20) {
            logger.debug('当前页结果数量较少，可能接近最后一页', 'LotteryCrawlerPuppeteer', {
              currentPage,
              pageResultsCount: pageResults.length,
              savedCount,
              existingCount
            })
            // 不立即停止，继续尝试下一页
          }

          currentPage++

          // 添加延迟（避免请求过快）
          if (currentPage <= maxPages) {
            const delay = 2000 + Math.random() * 1000
            logger.debug(`等待 ${delay.toFixed(0)}ms 后继续爬取下一页`, 'LotteryCrawlerPuppeteer', {
              currentPage,
              nextPage: currentPage
            })
            await new Promise(resolve => setTimeout(resolve, delay))
          }

        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          logger.error(`爬取第 ${currentPage} 页失败`, errorObj, 'LotteryCrawlerPuppeteer', { currentPage })
          
          if (currentPage > 1) {
            hasMore = false
            break
          }
          throw error
        }
      }

      logger.info(`爬取完成，共获取 ${results.length} 条开奖结果`, 'LotteryCrawlerPuppeteer', {
        totalResults: results.length,
        savedCount,
        existingCount,
        skippedCount,
        totalExtracted,
        totalPages: currentPage - 1,
        successRate: totalExtracted > 0 ? ((savedCount / totalExtracted) * 100).toFixed(1) + '%' : '0%',
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        summary: savedCount > 0 
          ? `成功新保存 ${savedCount} 条数据` 
          : existingCount > 0 
            ? `所有 ${existingCount} 条数据都已存在于数据库中，如需爬取更早的数据，请使用"自定义时间段"模式`
            : `未获取到有效数据`
      })

      // 验证数据库中的实际记录数
      try {
        const actualCount = await this.prisma.lotteryResult.count()
        const beforeCount = actualCount - savedCount // 估算爬取前的记录数
        
        logger.info(`数据库验证: 实际记录数 ${actualCount}，本次新保存 ${savedCount} 条，已存在 ${existingCount} 条`, 'LotteryCrawlerPuppeteer', {
          actualCount,
          savedCount,
          existingCount,
          skippedCount,
          totalExtracted,
          beforeCount,
          expectedAfterCount: beforeCount + savedCount,
          actualDifference: actualCount - beforeCount
        })
        
        // 如果实际保存的数量与预期不符，记录警告
        if (actualCount < beforeCount + savedCount) {
          logger.warn(`⚠️ 数据库记录数异常: 预期 ${beforeCount + savedCount} 条，实际 ${actualCount} 条，可能部分数据未保存成功`, 'LotteryCrawlerPuppeteer', {
            expected: beforeCount + savedCount,
            actual: actualCount,
            missing: (beforeCount + savedCount) - actualCount
          })
        }
      } catch (countError) {
        logger.warn('无法验证数据库记录数', 'LotteryCrawlerPuppeteer', {
          error: countError instanceof Error ? countError.message : String(countError)
        })
      }

      // 打印前5条数据用于调试
      if (results.length > 0) {
        logger.info('爬取到的前5条数据示例', 'LotteryCrawlerPuppeteer', {
          samples: results.slice(0, 5).map((r, i) => ({
            index: i + 1,
            period: r.period,
            date: r.date,
            redBalls: r.redBalls,
            blueBall: r.blueBall,
            url: r.url
          }))
        })
      } else {
        logger.warn('爬取完成但未获取到任何数据', 'LotteryCrawlerPuppeteer', {
          totalPages: currentPage - 1,
          totalExtracted,
          savedCount,
          skippedCount
        })
      }

      return {
        success: true,
        data: results,
        total: savedCount, // 返回实际新保存的数量
        saved: savedCount,
        existing: existingCount, // 已存在的数量
        skipped: skippedCount,
        extracted: totalExtracted
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error('爬取开奖结果失败', errorObj, 'LotteryCrawlerPuppeteer')
      return {
        success: false,
        data: [],
        total: 0,
        error: errorObj.message,
      }
    } finally {
      if (browser) {
        await browser.close()
        logger.debug('浏览器已关闭', 'LotteryCrawlerPuppeteer')
      }
    }
  }

  /**
   * 使用 Puppeteer 爬取指定页面
   */
  private async crawlPageWithPuppeteer(
    page: any,
    pageNum: number,
    startDate: Date,
    endDate: Date,
    lastPageFirstPeriod: string = ''
  ): Promise<LotteryResult[]> {
    const results: LotteryResult[] = []

    try {
      // 第一页直接访问，后续页面通过点击"下一页"按钮
      if (pageNum === 1) {
        // 第一页：直接访问
        logger.info(`🔍 访问第 1 页: ${this.baseUrl}`, 'LotteryCrawlerPuppeteer.Page', { 
          page: 1, 
          url: this.baseUrl
        })
        await page.goto(this.baseUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        })
      } else {
        // 第二页及以后：通过连续点击"下一页"按钮
        logger.info(`🔍 尝试点击"下一页"按钮跳转到第 ${pageNum} 页`, 'LotteryCrawlerPuppeteer.Page', {
          page: pageNum,
          needClicks: pageNum - 1 // 需要点击的次数
        })
        
        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 需要点击"下一页"按钮 (pageNum - 1) 次
        for (let clickCount = 1; clickCount < pageNum; clickCount++) {
          try {
            // 查找"下一页"按钮
            const nextButtonInfo = await page.evaluate(() => {
              // 查找所有可能的"下一页"按钮
              const links = Array.from(document.querySelectorAll('a'))
              for (const link of links) {
                const text = link.textContent?.trim() || ''
                const href = link.getAttribute('href') || ''
                const onclick = link.getAttribute('onclick') || ''
                const className = link.className || ''
                
                // 检查文本内容
                if (text.includes('下一页') || text.includes('下页') || text === '>' || text === '»') {
                  return {
                    found: true,
                    text,
                    href,
                    onclick,
                    className,
                    type: 'text-match'
                  }
                }
                
                // 检查class名称
                if (className.includes('next') || className.includes('下一页')) {
                  return {
                    found: true,
                    text,
                    href,
                    onclick,
                    className,
                    type: 'class-match'
                  }
                }
              }
              
              // 查找分页容器中的下一个按钮
              const pagination = document.querySelector('.pagination, .page, .pager, [class*="page"]')
              if (pagination) {
                const nextLink = pagination.querySelector('a:last-child, .next, [class*="next"]')
                if (nextLink) {
                  return {
                    found: true,
                    text: nextLink.textContent?.trim() || '',
                    href: (nextLink as HTMLElement).getAttribute('href') || '',
                    onclick: (nextLink as HTMLElement).getAttribute('onclick') || '',
                    type: 'pagination-next'
                  }
                }
              }
              
              return { found: false }
            })
            
            if (nextButtonInfo.found) {
              logger.info(`找到"下一页"按钮 (第 ${clickCount} 次点击): ${nextButtonInfo.type}`, 'LotteryCrawlerPuppeteer.Page', {
                page: pageNum,
                clickCount,
                buttonInfo: nextButtonInfo
              })
              
              // 尝试点击
              try {
                // 方式1: 如果有href且不是javascript，直接导航
                if (nextButtonInfo.href && !nextButtonInfo.href.startsWith('javascript:')) {
                  let clickUrl = nextButtonInfo.href
                  if (clickUrl.startsWith('/')) {
                    clickUrl = `https://www.cwl.gov.cn${clickUrl}`
                  } else if (!clickUrl.startsWith('http')) {
                    clickUrl = `${this.baseUrl}${clickUrl}`
                  }
                  
                  logger.debug(`通过URL导航: ${clickUrl}`, 'LotteryCrawlerPuppeteer.Page', {
                    clickCount,
                    clickUrl
                  })
                  await page.goto(clickUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000,
                  })
                } else {
                  // 方式2: 通过选择器点击
                  // 构建选择器
                  let selector = ''
                  if (nextButtonInfo.href) {
                    selector = `a[href="${nextButtonInfo.href}"]`
                  } else if (nextButtonInfo.text) {
                    // 使用XPath或文本匹配
                    selector = `a:has-text("${nextButtonInfo.text}")`
                  } else {
                    selector = '.pagination .next, .pagination a:last-child, [class*="next"]'
                  }
                  
                  logger.debug(`通过选择器点击: ${selector}`, 'LotteryCrawlerPuppeteer.Page', {
                    clickCount,
                    selector
                  })
                  
                  // 尝试多种点击方式
                  try {
                    await page.click(selector)
                  } catch (e1) {
                    // 如果选择器失败，尝试通过evaluate点击
                    await page.evaluate(() => {
                      const links = Array.from(document.querySelectorAll('a'))
                      for (const link of links) {
                        const text = link.textContent?.trim() || ''
                        if (text.includes('下一页') || text === '>' || text === '»') {
                          (link as HTMLElement).click()
                          return
                        }
                      }
                    })
                  }
                  
                  // 等待页面加载
                  await new Promise(resolve => setTimeout(resolve, 2000))
                }
                
                logger.info(`✓ 成功点击"下一页"按钮 (第 ${clickCount}/${pageNum - 1} 次)`, 'LotteryCrawlerPuppeteer.Page', {
                  page: pageNum,
                  clickCount,
                  totalClicks: pageNum - 1
                })
              } catch (clickError) {
                logger.error(`点击"下一页"按钮失败 (第 ${clickCount} 次)`, 
                  clickError instanceof Error ? clickError : new Error(String(clickError)), 
                  'LotteryCrawlerPuppeteer.Page', 
                  {
                    page: pageNum,
                    clickCount,
                    error: clickError instanceof Error ? clickError.message : String(clickError)
                  }
                )
                throw clickError
              }
            } else {
              logger.error(`❌ 未找到"下一页"按钮 (第 ${clickCount} 次点击)`, 
                new Error('未找到"下一页"按钮'), 
                'LotteryCrawlerPuppeteer.Page', 
                {
                  page: pageNum,
                  clickCount
                }
              )
              throw new Error(`未找到"下一页"按钮，无法翻页到第 ${pageNum} 页`)
            }
          } catch (clickError) {
            logger.error(`翻页失败 (第 ${clickCount} 次点击)`, 
              clickError instanceof Error ? clickError : new Error(String(clickError)), 
              'LotteryCrawlerPuppeteer.Page', 
              {
                page: pageNum,
                clickCount,
                error: clickError instanceof Error ? clickError.message : String(clickError)
              }
            )
            throw clickError
          }
        }
        
        logger.info(`✓ 成功翻页到第 ${pageNum} 页`, 'LotteryCrawlerPuppeteer.Page', {
          page: pageNum,
          totalClicks: pageNum - 1
        })
      }
      
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 等待页面加载完成（等待表格出现）
      try {
        await page.waitForSelector('table', { timeout: 10000 })
        logger.debug('表格已加载', 'LotteryCrawlerPuppeteer.Page', { page: pageNum })
      } catch (e) {
        logger.warn('未找到表格，可能页面结构不同', 'LotteryCrawlerPuppeteer.Page', { page: pageNum })
      }

      // 等待一下，确保 JavaScript 执行完成（使用 Promise 替代 waitForTimeout）
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 验证页面内容，确保真的翻页了（通过检查第一行的期号）
      if (pageNum > 1) {
        try {
          const firstPeriod = await page.evaluate(() => {
            const firstRow = document.querySelector('table tbody tr')
            if (firstRow) {
              const cells = firstRow.querySelectorAll('td')
              if (cells.length > 0) {
                return cells[0]?.textContent?.trim() || ''
              }
            }
            return ''
          })
          
          logger.info(`📄 第 ${pageNum} 页第一行期号: ${firstPeriod}`, 'LotteryCrawlerPuppeteer.Page', {
            page: pageNum,
            firstPeriod,
            lastPageFirstPeriod
          })
          
          // 如果第一行的期号与上一页相同，说明没有翻页成功
          if (lastPageFirstPeriod && firstPeriod === lastPageFirstPeriod) {
            logger.error(`❌ 翻页失败！第 ${pageNum} 页的第一行期号与上一页相同: ${firstPeriod}`, 
              new Error('页面内容未变化，可能翻页未成功，尝试其他分页方式'), 
              'LotteryCrawlerPuppeteer.Page', 
              {
                page: pageNum,
                firstPeriod,
                lastPageFirstPeriod,
                message: '页面内容未变化，可能翻页未成功，尝试其他分页方式'
              }
            )
            
            // 尝试其他分页URL格式
            const alternativeUrls = [
              `${this.baseUrl}?p=${pageNum}`,
              `${this.baseUrl}?pageNum=${pageNum}`,
              `${this.baseUrl}?currentPage=${pageNum}`,
              `${this.baseUrl.replace(/\/$/, '')}/page/${pageNum}`,
            ]
            
            let retried = false
            for (const altUrl of alternativeUrls) {
              try {
                logger.info(`🔄 尝试替代URL: ${altUrl}`, 'LotteryCrawlerPuppeteer.Page', {
                  page: pageNum,
                  altUrl
                })
                await page.goto(altUrl, {
                  waitUntil: 'networkidle2',
                  timeout: 30000,
                })
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                // 再次验证
                const newFirstPeriod = await page.evaluate(() => {
                  const firstRow = document.querySelector('table tbody tr')
                  if (firstRow) {
                    const cells = firstRow.querySelectorAll('td')
                    if (cells.length > 0) {
                      return cells[0]?.textContent?.trim() || ''
                    }
                  }
                  return ''
                })
                
                if (newFirstPeriod && newFirstPeriod !== lastPageFirstPeriod) {
                  logger.info(`✓ 替代URL成功翻页: ${altUrl}，第一行期号: ${newFirstPeriod}`, 'LotteryCrawlerPuppeteer.Page', {
                    page: pageNum,
                    altUrl,
                    newFirstPeriod
                  })
                  retried = true
                  break
                }
              } catch (e) {
                // 继续尝试下一个URL
              }
            }
            
            if (!retried) {
              // 所有方式都失败，抛出错误
              throw new Error(`翻页失败：第 ${pageNum} 页内容与上一页相同，所有分页方式都尝试失败`)
            }
          }
        } catch (e) {
          logger.warn('无法获取第一行期号用于验证', 'LotteryCrawlerPuppeteer.Page', {
            page: pageNum,
            error: e instanceof Error ? e.message : String(e)
          })
        }
      }

      // 先获取页面内容用于调试
      const pageContent = await page.content()
      logger.debug('页面内容长度', 'LotteryCrawlerPuppeteer.Page', {
        page: pageNum,
        contentLength: pageContent.length,
        hasTable: pageContent.includes('<table'),
      })

      // 提取数据 - 根据实际HTML结构
      const pageResults = await page.evaluate((startDateStr: string, endDateStr: string) => {
        const results: any[] = []
        const start = new Date(startDateStr)
        const end = new Date(endDateStr)

        console.log('开始提取数据，日期范围:', startDateStr, '到', endDateStr)

        // 查找所有表格（特别是 class="ssq_table" 的表格）
        const tables = document.querySelectorAll('table')
        console.log('找到表格数量:', tables.length)
        
        tables.forEach((table, tableIndex) => {
          // 只处理 tbody 中的行（跳过 thead）
          const tbody = table.querySelector('tbody')
          if (!tbody) return
          
          const rows = tbody.querySelectorAll('tr')
          console.log(`表格 ${tableIndex + 1} tbody 有 ${rows.length} 行`)
          
          rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td')
            if (cells.length < 3) return
            
            // 第一列：期号（格式：2025145，没有"期"字）
            const periodText = cells[0]?.textContent?.trim() || ''
            const period = periodText.match(/^\d{7}$/) ? periodText : ''
            
            // 第二列：日期（格式：2025-12-16(二)）
            const dateText = cells[1]?.textContent?.trim() || ''
            const dateMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/)
            const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : ''
            
            // 第三列：开奖号码（使用 div.qiu-item 结构）
            const numbersCell = cells[2]
            if (!numbersCell) return
            
            // 方法1：从 div.qiu-item 中提取
            const qiuItems = numbersCell.querySelectorAll('.qiu-item')
            let redBalls: string[] = []
            let blueBall = ''
            
            if (qiuItems.length >= 7) {
              // 按照页面上的原始顺序提取，保持开奖顺序
              // 遍历所有 qiu-item，按照它们在页面上的顺序提取红球和蓝球
              const allItems = Array.from(qiuItems)
              const redItemsInOrder: any[] = []
              let blueItem: any = null
              
              // 按照页面上的顺序遍历，保持原始顺序
              for (const item of allItems) {
                const className = (item as any).className || ''
                if (className.includes('blue') && !blueItem) {
                  // 找到第一个蓝球
                  blueItem = item
                } else if (className.includes('red')) {
                  // 收集所有红球，保持它们在页面上的顺序
                  redItemsInOrder.push(item)
                }
              }
              
              // 如果通过 class 识别成功（找到6个红球和1个蓝球）
              if (redItemsInOrder.length >= 6 && blueItem) {
                // 按照页面上的顺序提取红球（不排序，保持原始顺序）
                redBalls = redItemsInOrder.slice(0, 6).map((item: any) => {
                  const num = item.textContent?.trim() || ''
                  return num.padStart(2, '0')
                })
                blueBall = (blueItem.textContent?.trim() || '').padStart(2, '0')
              } else {
                // 如果分类失败，按顺序取：前6个是红球，最后1个是蓝球（保持原始顺序）
                // 这是最常见的排列方式：红球在前，蓝球在最后
                redBalls = Array.from(qiuItems).slice(0, 6).map((item: any) => {
                  const num = item.textContent?.trim() || ''
                  return num.padStart(2, '0')
                })
                blueBall = (qiuItems[qiuItems.length - 1]?.textContent?.trim() || '').padStart(2, '0')
              }
            } else {
              // 方法2：如果 div.qiu-item 不存在，从文本中提取
              const numbersText = numbersCell.textContent?.trim() || ''
              const allNumbers = numbersText.match(/\b(\d{1,2})\b/g) || []
              
              if (allNumbers.length >= 7) {
                // 按照文本中的顺序提取，前6个是红球，最后1个是蓝球
                redBalls = allNumbers.slice(0, 6).map(n => n.padStart(2, '0'))
                blueBall = allNumbers[allNumbers.length - 1].padStart(2, '0')
              }
            }
            
            // 提取详情URL（通常在最后一列）
            const link = row.querySelector('a')
            const url = link ? (link.getAttribute('href') || undefined) : undefined
            
            // 验证数据
            if (period && date && redBalls.length >= 6 && blueBall) {
              const resultDate = new Date(date)
              const startDate = new Date(startDateStr)
              const endDate = new Date(endDateStr)
              
              console.log('检查日期范围:', {
                period,
                date,
                resultDate: resultDate.toISOString(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                inRange: resultDate >= startDate && resultDate <= endDate
              })
              
              if (resultDate >= startDate && resultDate <= endDate) {
                console.log('找到有效结果:', period, date, redBalls, blueBall)
                results.push({
                  period,
                  date,
                  redBalls,
                  blueBall,
                  url: url ? (url.startsWith('http') ? url : `https://www.cwl.gov.cn${url}`) : undefined,
                })
              } else {
                console.log('日期超出范围:', date, '不在', startDateStr, '到', endDateStr, {
                  resultDate: resultDate.toISOString(),
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString()
                })
              }
            } else {
              console.log('数据不完整:', { 
                period, 
                date, 
                redBalls: redBalls.length, 
                blueBall,
                periodText,
                dateText,
                qiuItemsCount: qiuItems.length
              })
            }
          })
        })

        console.log('提取完成，共找到', results.length, '条结果')
        return results
      }, startDate.toISOString(), endDate.toISOString())

      logger.debug(`页面 ${pageNum} 提取完成，原始结果数: ${pageResults.length}`, 'LotteryCrawlerPuppeteer.Page', {
        page: pageNum,
        pageResultsCount: pageResults.length,
        firstResult: pageResults[0] ? {
          period: pageResults[0].period,
          date: pageResults[0].date,
          redBalls: pageResults[0].redBalls,
          blueBall: pageResults[0].blueBall
        } : null
      })

      results.push(...pageResults)

      // 如果没找到数据，尝试获取页面文本用于调试
      if (results.length === 0 && pageResults.length === 0) {
        const pageText = await page.evaluate(() => {
          return {
            bodyText: document.body?.textContent?.substring(0, 2000) || '',
            tableCount: document.querySelectorAll('table').length,
            trCount: document.querySelectorAll('tr').length,
            firstTableHTML: document.querySelector('table')?.outerHTML?.substring(0, 1000) || '',
          }
        })
        
        logger.warn('页面未提取到数据', 'LotteryCrawlerPuppeteer.Page', {
          page: pageNum,
          pageText: pageText.bodyText.substring(0, 500),
          tableCount: pageText.tableCount,
          trCount: pageText.trCount,
          firstTablePreview: pageText.firstTableHTML,
        })
      }

      logger.info(`页面 ${pageNum} 解析完成，获取 ${results.length} 条结果`, 'LotteryCrawlerPuppeteer.Page', {
        page: pageNum,
        resultsCount: results.length
      })

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error(`爬取页面 ${pageNum} 失败`, errorObj, 'LotteryCrawlerPuppeteer.Page', { page: pageNum })
      throw error
    }

    return results
  }

  /**
   * 保存单条结果到数据库（带重试机制）
   */
  private async saveResult(result: LotteryResult, retryCount: number = 0): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    const maxRetries = 3
    const retryDelay = 1000 // 1秒

    try {
      // 验证数据
      if (!result.period || !result.date || !result.redBalls || result.redBalls.length < 6 || !result.blueBall) {
        logger.warn(`数据验证失败: 期号=${result.period}, 日期=${result.date}, 红球数量=${result.redBalls?.length || 0}, 蓝球=${result.blueBall}`, 'LotteryCrawlerPuppeteer.saveResult', {
          period: result.period,
          date: result.date,
          redBalls: result.redBalls,
          blueBall: result.blueBall,
          redBallsLength: result.redBalls?.length || 0
        })
        return {
          success: false,
          error: `数据不完整: 期号=${result.period}, 日期=${result.date}, 红球数量=${result.redBalls?.length || 0}, 蓝球=${result.blueBall}`
        }
      }

      // 验证期号格式（应该是7位数字）
      if (!/^\d{7}$/.test(result.period)) {
        logger.warn(`期号格式无效: ${result.period}`, 'LotteryCrawlerPuppeteer.saveResult', {
          period: result.period,
          periodLength: result.period?.length || 0
        })
        return {
          success: false,
          error: `期号格式无效: ${result.period} (期望7位数字)`
        }
      }

      // 验证日期格式
      let dateObj: Date
      try {
        dateObj = new Date(result.date)
        if (isNaN(dateObj.getTime())) {
          logger.warn(`日期格式无效: ${result.date}`, 'LotteryCrawlerPuppeteer.saveResult', {
            date: result.date,
            dateType: typeof result.date
          })
          return {
            success: false,
            error: `日期格式无效: ${result.date}`
          }
        }
      } catch (e) {
        logger.warn(`日期解析失败: ${result.date}`, 'LotteryCrawlerPuppeteer.saveResult', {
          date: result.date,
          error: e instanceof Error ? e.message : String(e)
        })
        return {
          success: false,
          error: `日期解析失败: ${result.date}`
        }
      }

      // 尝试保存（带重试）
      try {
        // 检查是否已存在（根据期号）
        const existing = await this.prisma.lotteryResult.findUnique({
          where: { period: result.period },
        })

        if (existing) {
          // 如果已存在，直接跳过，不保存也不更新
          logger.debug(`期号 ${result.period} 已存在于数据库，跳过`, 'LotteryCrawlerPuppeteer.saveResult', {
            period: result.period,
            existingDate: existing.date
          })
          return { 
            success: true,
            skipped: true // 标记为跳过（已存在）
          }
        } else {
          // 创建新记录
          logger.debug(`准备创建新记录: ${result.period}`, 'LotteryCrawlerPuppeteer.saveResult', {
            period: result.period,
            date: dateObj.toISOString(),
            redBalls: result.redBalls,
            blueBall: result.blueBall
          })
          
          const created = await this.prisma.lotteryResult.create({
            data: {
              period: result.period,
              date: dateObj,
              redBalls: result.redBalls,
              blueBall: result.blueBall,
              url: result.url,
              metadata: result.metadata || {},
            },
          })
          
          logger.debug(`成功创建记录: ${result.period} (ID: ${created.id})`, 'LotteryCrawlerPuppeteer.saveResult', {
            period: result.period,
            id: created.id
          })
          
          // 立即验证数据库，确保数据真正保存成功
          try {
            const verified = await this.prisma.lotteryResult.findUnique({
              where: { period: result.period },
              select: { id: true, period: true, date: true }
            })
            
            if (!verified) {
              logger.error(`❌ 保存后验证失败: 期号 ${result.period} 不存在于数据库中`, 
                new Error(`保存后验证失败: 期号 ${result.period} 不存在于数据库中`), 
                'LotteryCrawlerPuppeteer.saveResult', 
                {
                  period: result.period,
                  createdId: created.id,
                  date: dateObj.toISOString()
                }
              )
              return {
                success: false,
                error: `保存后验证失败: 期号 ${result.period} 不存在于数据库中`
              }
            }
            
            logger.debug(`✓ 保存验证成功: ${result.period} (ID: ${verified.id})`, 'LotteryCrawlerPuppeteer.saveResult', {
              period: result.period,
              id: verified.id,
              verifiedDate: verified.date
            })
          } catch (verifyError) {
            const verifyErrorObj = verifyError instanceof Error ? verifyError : new Error(String(verifyError))
            logger.error(`❌ 保存后验证时发生错误: ${result.period}`, verifyErrorObj, 'LotteryCrawlerPuppeteer.saveResult', {
              period: result.period,
              createdId: created.id,
              error: verifyErrorObj.message
            })
            // 即使验证失败，也返回成功（因为create操作已经成功）
            // 但记录错误以便后续排查
          }
          
          return { 
            success: true,
            skipped: false // 标记为新保存
          }
        }
      } catch (dbError) {
        // 数据库错误，尝试重试
        const errorObj = dbError instanceof Error ? dbError : new Error(String(dbError))
        const errorMessage = errorObj.message.toLowerCase()
        
        // 如果是唯一约束冲突（已存在），不算错误
        if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
          logger.debug(`期号 ${result.period} 已存在（唯一约束冲突），跳过`, 'LotteryCrawlerPuppeteer', {
            period: result.period
          })
          return { 
            success: true,
            skipped: true // 已存在，跳过
          }
        }

        // 如果是连接错误或超时，尝试重试
        if (retryCount < maxRetries && (
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          errorMessage.includes('econnreset') ||
          errorMessage.includes('prisma')
        )) {
          logger.warn(`保存失败，${retryDelay}ms 后重试 (${retryCount + 1}/${maxRetries}): ${result.period}`, 'LotteryCrawlerPuppeteer', {
            period: result.period,
            error: errorObj.message,
            retryCount: retryCount + 1
          })
          await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)))
          return this.saveResult(result, retryCount + 1)
        }

        // 其他错误或重试次数用完
        throw errorObj
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error(`保存结果失败: ${result.period}`, errorObj, 'LotteryCrawlerPuppeteer', {
        period: result.period,
        date: result.date,
        retryCount,
        error: errorObj.message,
        stack: errorObj.stack
      })
      return {
        success: false,
        error: errorObj.message
      }
    }
  }
}

