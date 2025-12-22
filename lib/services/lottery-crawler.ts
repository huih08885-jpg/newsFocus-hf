/**
 * 中国福利彩票开奖结果爬虫
 * 爬取 https://www.cwl.gov.cn/ygkj/wqkjgg/ 近5年的往期开奖结果
 */

import { fetchHTML } from '@/lib/utils/fetch-helper'
import { HTMLParser } from '@/lib/utils/html-parser'
import { logger } from '@/lib/utils/logger'

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
}

export class LotteryCrawler {
  private baseUrl = 'https://www.cwl.gov.cn/ygkj/wqkjgg/'
  private cookies: string = ''

  /**
   * 初始化：先访问首页获取 cookies
   */
  private async initialize(): Promise<void> {
    try {
      logger.debug('初始化：访问首页获取 cookies', 'LotteryCrawler.Init')
      
      // 使用 fetch-helper 获取更真实的浏览器行为
      const { fetchHTML } = await import('@/lib/utils/fetch-helper')
      
      try {
        const html = await fetchHTML('https://www.cwl.gov.cn/', {
          referer: 'https://www.cwl.gov.cn/',
          origin: 'https://www.cwl.gov.cn/',
          timeout: 15000,
          retries: 2,
          retryDelay: 2000,
          checkRobots: false,
        })
        
        logger.debug('初始化成功，已获取 cookies', 'LotteryCrawler.Init')
      } catch (fetchError) {
        // 如果 fetchHTML 失败，尝试普通 fetch
        logger.warn('fetchHTML 失败，尝试普通 fetch', 'LotteryCrawler.Init', {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        })
        
        const response = await fetch('https://www.cwl.gov.cn/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // 提取 cookies
        const setCookieHeader = response.headers.get('set-cookie')
        if (setCookieHeader) {
          const cookies = Array.isArray(setCookieHeader) 
            ? setCookieHeader 
            : setCookieHeader.split(',').map(c => c.trim())
          this.cookies = cookies.join('; ')
          logger.debug(`获取到 cookies`, 'LotteryCrawler.Init')
        }
      }
      
      // 等待一下，模拟真实用户行为
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      logger.warn('初始化失败，继续尝试', 'LotteryCrawler.Init', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 爬取开奖结果
   */
  async crawl(options: CrawlOptions = {}): Promise<{
    success: boolean
    data: LotteryResult[]
    total: number
    error?: string
  }> {
    const { years = 5, startDate, endDate, maxPages = 1000 } = options

    try {
      logger.info('开始爬取福利彩票开奖结果', 'LotteryCrawler', { years, maxPages, startDate, endDate })

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

      logger.info(`日期范围: ${start.toISOString().split('T')[0]} 至 ${end.toISOString().split('T')[0]}`, 'LotteryCrawler')

      // 初始化：获取 cookies
      await this.initialize()

      const results: LotteryResult[] = []
      let currentPage = 1
      let hasMore = true
      let lastDate: Date | null = null
      let consecutiveErrors = 0 // 连续错误计数
      const maxConsecutiveErrors = 3 // 最大连续错误次数

      // 爬取所有页面
      while (hasMore && currentPage <= maxPages) {
        try {
          logger.info(`正在爬取第 ${currentPage} 页`, 'LotteryCrawler', { currentPage, resultsCount: results.length })

          // 添加延迟，避免请求过快（模拟真实用户行为）
          if (currentPage > 1) {
            const delay = 3000 + Math.random() * 2000 // 3-5秒随机延迟
            logger.debug(`等待 ${delay.toFixed(0)}ms 后继续爬取`, 'LotteryCrawler', { currentPage, delay })
            await new Promise(resolve => setTimeout(resolve, delay))
          }

          const pageResults = await this.crawlPage(currentPage)
          
          // 重置连续错误计数
          consecutiveErrors = 0

          if (pageResults.length === 0) {
            logger.info('当前页无数据，停止爬取', 'LotteryCrawler', { currentPage })
            hasMore = false
            break
          }

          // 过滤日期范围
          for (const result of pageResults) {
            const resultDate = new Date(result.date)
            
            // 如果结果日期早于开始日期，停止爬取
            if (resultDate < start) {
              logger.info(`结果日期 ${result.date} 早于开始日期，停止爬取`, 'LotteryCrawler', {
                resultDate: result.date,
                startDate: start.toISOString().split('T')[0]
              })
              hasMore = false
              break
            }

            // 如果结果日期晚于结束日期，跳过
            if (resultDate > end) {
              continue
            }

            results.push(result)
            lastDate = resultDate
          }

          // 如果当前页所有结果都早于开始日期，停止
          if (!hasMore) {
            break
          }

          // 如果当前页结果数量少于预期，可能已到最后一页
          if (pageResults.length < 20) {
            logger.info('当前页结果数量较少，可能已到最后一页', 'LotteryCrawler', {
              currentPage,
              pageResultsCount: pageResults.length
            })
            hasMore = false
            break
          }

          currentPage++

          // 添加延迟，避免请求过快（政府网站可能需要更长的延迟）
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))

        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          consecutiveErrors++
          logger.error(`爬取第 ${currentPage} 页失败`, errorObj, 'LotteryCrawler', { 
            currentPage, 
            consecutiveErrors,
            error: errorObj.message 
          })
          
          // 如果连续失败超过阈值，停止爬取
          if (consecutiveErrors >= maxConsecutiveErrors) {
            logger.warn(`连续失败 ${consecutiveErrors} 次，停止爬取`, 'LotteryCrawler', {
              consecutiveErrors,
              maxConsecutiveErrors
            })
            hasMore = false
            break
          }
          
          // 如果是第一页失败，直接抛出错误
          if (currentPage === 1) {
            throw error
          }
          
          // 其他页面失败，等待后继续尝试下一页
          await new Promise(resolve => setTimeout(resolve, 5000))
          currentPage++
        }
      }

      logger.info(`爬取完成，共获取 ${results.length} 条开奖结果`, 'LotteryCrawler', {
        totalResults: results.length,
        totalPages: currentPage - 1,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      })

      return {
        success: true,
        data: results,
        total: results.length,
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error('爬取开奖结果失败', errorObj, 'LotteryCrawler')
      return {
        success: false,
        data: [],
        total: 0,
        error: errorObj.message,
      }
    }
  }

  /**
   * 爬取指定页面
   */
  private async crawlPage(page: number): Promise<LotteryResult[]> {
    const results: LotteryResult[] = []

    try {
      // 构建URL（可能需要根据实际网站结构调整）
      let url = this.baseUrl
      if (page > 1) {
        // 尝试不同的分页URL格式
        url = `${this.baseUrl}?page=${page}`
      }

      logger.debug(`请求页面: ${url}`, 'LotteryCrawler.Page', { page, url })

      // 使用更真实的浏览器请求头
      const customHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      }

      // 如果有 cookies，添加到请求头
      if (this.cookies) {
        customHeaders['Cookie'] = this.cookies
      }

      // 使用增强的 fetch，带重试和代理回退
      let html: string
      try {
        html = await fetchHTML(url, {
          timeout: 30000,
          retries: 3,
          retryDelay: 2000,
          checkRobots: false,
          referer: page === 1 ? 'https://www.cwl.gov.cn/' : this.baseUrl,
          origin: 'https://www.cwl.gov.cn',
          proxyFallback: true, // 如果直接请求失败（如403），尝试使用代理
          headers: customHeaders,
        })
        logger.debug(`成功获取页面 ${page} HTML，长度: ${html.length}`, 'LotteryCrawler.Page', { page })
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
        logger.error(`获取页面 ${page} 失败`, fetchError instanceof Error ? fetchError : new Error(errorMsg), 'LotteryCrawler.Page', {
          page,
          url,
          error: errorMsg,
          hasProxyFallback: true
        })
        throw new Error(`HTTP 403: Forbidden - 无法访问目标网站，可能被反爬虫机制阻止。错误: ${errorMsg}`)
      }

      // 调试：保存 HTML 到日志（仅前 5000 字符）
      if (page === 1) {
        // 查找包含数据的部分
        const dataSectionMatch = html.match(/<table[^>]*>[\s\S]{0,5000}<\/table>/gi)
        logger.debug(`获取到的 HTML 长度: ${html.length}`, 'LotteryCrawler.Page', {
          htmlPreview: html.substring(0, 2000),
          tableSections: dataSectionMatch ? dataSectionMatch.slice(0, 2).map((t: string, i: number) => ({
            index: i,
            length: t.length,
            preview: t.substring(0, 500)
          })) : []
        })
      }

      const $ = HTMLParser.parse(html)

      // 调试：检查页面结构
      if (page === 1) {
        // 查找可能的 AJAX 请求或数据接口
        const scripts = $('script').toArray()
        const ajaxUrls: string[] = []
        scripts.forEach((script: any) => {
          const scriptText = $(script).html() || ''
          // 查找可能的 API URL
          const urlMatches = scriptText.match(/['"](https?:\/\/[^'"]+\/(api|data|query)[^'"]*)['"]/gi)
          if (urlMatches) {
            ajaxUrls.push(...urlMatches.map((m: string) => m.replace(/['"]/g, '')))
          }
        })

        logger.debug('页面结构分析', 'LotteryCrawler.Page', {
          hasTable: $('table').length,
          tableCount: $('table').length,
          trCount: $('tr').length,
          hasResultClass: $('[class*="result"]').length,
          hasLotteryClass: $('[class*="lottery"]').length,
          hasListClass: $('[class*="list"]').length,
          scriptCount: scripts.length,
          possibleAjaxUrls: ajaxUrls.slice(0, 5),
          bodyTextPreview: $('body').text().substring(0, 500),
        })
      }

      // 优先解析表格数据（最常见的结构）
      let foundResults = false
      
      // 查找所有表格
      $('table').each((tableIndex: number, table: any) => {
        if (foundResults) return false // 如果已找到结果，停止查找
        
        const $table = $(table)
        const rows = $table.find('tr')
        
        logger.debug(`处理表格 ${tableIndex + 1}，共 ${rows.length} 行`, 'LotteryCrawler.Page', {
          tableIndex: tableIndex + 1,
          rowCount: rows.length
        })
        
        rows.each((rowIndex: number, row: any) => {
          const $row = $(row)
          const rowText = $row.text().trim()
          const cells = $row.find('td, th')
          
          // 详细记录每一行的内容
          logger.debug(`表格 ${tableIndex + 1} 行 ${rowIndex + 1}`, 'LotteryCrawler.Page', {
            tableIndex: tableIndex + 1,
            rowIndex: rowIndex + 1,
            cellCount: cells.length,
            rowText: rowText.substring(0, 300),
            cellTexts: cells.map((i: number, el: any) => $(el).text().trim()).get().slice(0, 5)
          })
          
          // 跳过表头行（包含"期号"、"开奖日期"等关键词）
          if (rowText.includes('期号') || rowText.includes('开奖日期') || rowText.includes('开奖号码')) {
            logger.debug(`跳过表头行 ${rowIndex + 1}`, 'LotteryCrawler.Page', {
              rowIndex: rowIndex + 1,
              rowText: rowText.substring(0, 100)
            })
            return
          }
          
          // 尝试解析所有非表头行（即使没有匹配到期号格式）
          if (cells.length >= 3 && rowText.length > 10) {
            try {
              const result = this.parseTableRow($row, $)
              if (result && result.period && result.redBalls.length >= 6) {
                // 检查是否已存在
                if (!results.find(r => r.period === result.period)) {
                  results.push(result)
                  foundResults = true
                  logger.debug(`从表格行解析到结果: ${result.period}`, 'LotteryCrawler.Page', {
                    period: result.period,
                    date: result.date
                  })
                }
              } else {
                logger.debug(`表格行解析失败，尝试文本解析`, 'LotteryCrawler.Page', {
                  rowIndex: rowIndex + 1,
                  rowText: rowText.substring(0, 200)
                })
                // 如果表格解析失败，尝试文本解析
                const textResult = this.parseFromText(rowText)
                if (textResult && textResult.period && textResult.redBalls.length >= 6) {
                  if (!results.find(r => r.period === textResult.period)) {
                    results.push(textResult)
                    foundResults = true
                    logger.debug(`从文本解析到结果: ${textResult.period}`, 'LotteryCrawler.Page')
                  }
                }
              }
            } catch (error) {
              logger.debug(`解析表格行 ${rowIndex + 1} 失败`, 'LotteryCrawler.Page', {
                rowIndex: rowIndex + 1,
                error: error instanceof Error ? error.message : String(error),
                rowText: rowText.substring(0, 200)
              })
            }
          }
        })
      })

      // 如果表格解析没找到，尝试其他选择器
      if (!foundResults) {
        const resultSelectors = [
          '.result-list .result-item',
          '.lottery-result',
          '[class*="result"]',
          '[class*="lottery"]',
          '[class*="kj"]', // 开奖相关
          '[class*="qihao"]', // 期号相关
          'ul li',
          '.list-item',
        ]

        for (const selector of resultSelectors) {
          const items = $(selector)
          
          if (items.length > 0) {
            logger.debug(`使用选择器 ${selector} 找到 ${items.length} 个结果项`, 'LotteryCrawler.Page', {
              selector,
              count: items.length,
              firstItemText: items.first().text().substring(0, 200)
            })

            items.each((i, el) => {
              try {
                const itemText = $(el).text().trim()
                // 只处理包含期号或日期的内容
                if (itemText && (/\d{4,7}期/.test(itemText) || /\d{4}[-年]\d{1,2}[-月]\d{1,2}/.test(itemText))) {
                  const result = this.parseResultItem($(el), $)
                  if (result) {
                    results.push(result)
                    foundResults = true
                  }
                }
              } catch (error) {
                logger.debug(`解析第 ${i + 1} 个结果项失败`, 'LotteryCrawler.Page', {
                  index: i,
                  error: error instanceof Error ? error.message : String(error)
                })
              }
            })

            if (foundResults) {
              break
            }
          }
        }
      }

      // 如果标准选择器没找到，尝试通用方法
      if (!foundResults) {
        logger.warn('未找到标准结果项，尝试通用解析', 'LotteryCrawler.Page', { page })
        const genericResults = this.parseGenericResults($)
        results.push(...genericResults)
      }

      logger.info(`页面 ${page} 解析完成，获取 ${results.length} 条结果`, 'LotteryCrawler.Page', {
        page,
        resultsCount: results.length
      })

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error(`爬取页面 ${page} 失败`, errorObj, 'LotteryCrawler.Page', { page })
      throw error
    }

    return results
  }

  /**
   * 解析表格行
   */
  private parseTableRow($row: any, $: any): LotteryResult | null {
    try {
      const cells = $row.find('td')
      if (cells.length < 3) {
        return null
      }

      // 通常表格结构：期号 | 开奖日期 | 开奖号码 | ...
      const periodText = $(cells[0]).text().trim()
      const dateText = $(cells[1]).text().trim()
      const numbersText = $(cells[2]).text().trim() // 开奖号码

      // 提取期号
      const periodMatch = periodText.match(/(\d{4}[-]?\d{3})期?/) || periodText.match(/(\d{7})/)
      const period = periodMatch ? periodMatch[1].replace(/-/g, '') : ''

      // 提取日期
      const datePatterns = [
        /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]?/,
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{4})\/(\d{2})\/(\d{2})/,
      ]
      
      let date = ''
      for (const pattern of datePatterns) {
        const dateMatch = dateText.match(pattern)
        if (dateMatch) {
          date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
          break
        }
      }

      // 从开奖号码中提取红球和蓝球
      // 可能的格式：01 02 03 04 05 06 + 07 或 01,02,03,04,05,06+07
      let redBalls: string[] = []
      let blueBall = ''

      // 尝试多种格式
      const numberFormats = [
        /(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[+\s]+(\d{1,2})/, // 标准格式
        /(\d{2})[,\s]+(\d{2})[,\s]+(\d{2})[,\s]+(\d{2})[,\s]+(\d{2})[,\s]+(\d{2})[+\s]+(\d{2})/, // 两位数字格式
        /红球[：:]\s*(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]*蓝球[：:]\s*(\d{1,2})/, // 中文格式
      ]

      let matched = false
      for (const format of numberFormats) {
        const match = numbersText.match(format)
        if (match) {
          redBalls = [
            match[1].padStart(2, '0'),
            match[2].padStart(2, '0'),
            match[3].padStart(2, '0'),
            match[4].padStart(2, '0'),
            match[5].padStart(2, '0'),
            match[6].padStart(2, '0'),
          ]
          blueBall = match[7].padStart(2, '0')
          matched = true
          break
        }
      }

      // 如果格式匹配失败，尝试提取所有数字
      if (!matched) {
        const allNumbers = numbersText.match(/\b(\d{1,2})\b/g) || []
        if (allNumbers.length >= 7) {
          redBalls = allNumbers.slice(0, 6).map((n: string) => n.padStart(2, '0'))
          blueBall = allNumbers[allNumbers.length - 1].padStart(2, '0')
          matched = true
        }
      }

      // 验证数据
      if (!period || !date || redBalls.length < 6 || !blueBall) {
        logger.debug('表格行数据不完整', 'LotteryCrawler.ParseTableRow', {
          period,
          date,
          redBallsCount: redBalls.length,
          blueBall,
          rowText: $row.text().substring(0, 200)
        })
        return null
      }

      // 提取详情URL（如果有链接）
      const link = $row.find('a').first().attr('href')
      const url = link ? this.resolveUrl(link) : undefined

      return {
        period,
        date,
        redBalls,
        blueBall,
        url,
      }
    } catch (error) {
      logger.debug('解析表格行失败', 'LotteryCrawler.ParseTableRow', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * 解析单个结果项
   */
  private parseResultItem($el: any, $: any): LotteryResult | null {
    try {
      // 提取期号
      const periodText = $el.find('td:first-child, .period, [class*="period"]').first().text().trim()
      const period = this.extractPeriod(periodText)

      // 提取日期
      const dateText = $el.find('td:nth-child(2), .date, [class*="date"]').first().text().trim()
      const date = this.extractDate(dateText)

      // 提取红球号码
      const redBalls: string[] = []
      $el.find('.red-ball, [class*="red"], .ball.red, td:nth-child(3) .ball').each((i: number, ball: any) => {
        const ballText = $(ball).text().trim()
        if (ballText && /^\d{1,2}$/.test(ballText)) {
          redBalls.push(ballText.padStart(2, '0'))
        }
      })

      // 如果没找到红球，尝试从文本中提取
      if (redBalls.length === 0) {
        const allText = $el.text()
        const redMatches = allText.match(/\b(\d{1,2})\b/g)
        if (redMatches && redMatches.length >= 6) {
          // 假设前6个数字是红球
          redBalls.push(...redMatches.slice(0, 6).map((n: string) => n.padStart(2, '0')))
        }
      }

      // 提取蓝球号码
      let blueBall = ''
      const blueText = $el.find('.blue-ball, [class*="blue"], .ball.blue, td:last-child .ball').first().text().trim()
      if (blueText && /^\d{1,2}$/.test(blueText)) {
        blueBall = blueText.padStart(2, '0')
      } else {
        // 尝试从文本中提取最后一个数字作为蓝球
        const allText = $el.text()
        const numbers = allText.match(/\b(\d{1,2})\b/g)
        if (numbers && numbers.length > 6) {
          blueBall = numbers[numbers.length - 1].padStart(2, '0')
        }
      }

      // 提取详情URL
      const url = $el.find('a').first().attr('href')
      const fullUrl = url ? this.resolveUrl(url) : undefined

      // 验证数据完整性
      if (!period || !date || redBalls.length < 6 || !blueBall) {
        logger.debug('结果项数据不完整，跳过', 'LotteryCrawler.Parse', {
          period,
          date,
          redBallsCount: redBalls.length,
          blueBall
        })
        return null
      }

      return {
        period,
        date,
        redBalls: redBalls.slice(0, 6), // 确保只有6个红球
        blueBall,
        url: fullUrl,
      }
    } catch (error) {
      logger.debug('解析结果项失败', 'LotteryCrawler.Parse', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * 通用解析方法（当标准选择器失效时使用）
   */
  private parseGenericResults($: any): LotteryResult[] {
    const results: LotteryResult[] = []

    try {
      // 方法1: 查找所有包含数字的表格行或列表项
      $('tr, .item, li, div[class*="item"], div[class*="result"], td').each((i: number, el: any) => {
        const text = $(el).text().trim()
        
        // 检查是否包含期号模式（如：2024001 或 2024-001）或日期
        if (text && (/\d{4,7}期/.test(text) || (/\d{4}[-年]\d{1,2}[-月]\d{1,2}/.test(text) && /\d{1,2}/.test(text)))) {
          const result = this.parseFromText(text)
          if (result && result.period && result.redBalls.length >= 6) {
            // 检查是否已存在
            if (!results.find(r => r.period === result.period)) {
              results.push(result)
            }
          }
        }
      })

      // 方法2: 如果方法1没找到，尝试从整个页面文本中提取
      if (results.length === 0) {
        const bodyText = $('body').text()
        // 尝试匹配多个开奖结果
        const periodMatches = bodyText.match(/\d{4,7}期/g)
        if (periodMatches && periodMatches.length > 0) {
          logger.debug(`从页面文本中找到 ${periodMatches.length} 个期号`, 'LotteryCrawler.Generic', {
            periods: periodMatches.slice(0, 5)
          })
          
          // 尝试提取每个期号附近的内容
          for (const period of periodMatches.slice(0, 20)) { // 限制处理数量
            const periodIndex = bodyText.indexOf(period)
            if (periodIndex >= 0) {
              const context = bodyText.substring(
                Math.max(0, periodIndex - 100),
                Math.min(bodyText.length, periodIndex + 500)
              )
              const result = this.parseFromText(context)
              if (result && result.period && result.redBalls.length >= 6) {
                // 检查是否已存在
                if (!results.find(r => r.period === result.period)) {
                  results.push(result)
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('通用解析失败', error instanceof Error ? error : new Error(String(error)), 'LotteryCrawler.Generic')
    }

    return results
  }

  /**
   * 从文本中解析开奖结果
   */
  private parseFromText(text: string): LotteryResult | null {
    try {
      // 提取期号（支持多种格式：2024001期、2024-001期、2024001等）
      const periodMatch = text.match(/(\d{4}[-]?\d{3})期?/) || text.match(/(\d{7})/)
      const period = periodMatch ? periodMatch[1].replace(/-/g, '') : ''

      // 提取日期（支持多种格式）
      const datePatterns = [
        /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]?/,
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{4})\/(\d{2})\/(\d{2})/,
      ]
      
      let date = ''
      for (const pattern of datePatterns) {
        const dateMatch = text.match(pattern)
        if (dateMatch) {
          date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
          break
        }
      }

      // 提取所有数字（排除期号和日期中的数字）
      // 先移除期号和日期，避免干扰
      let cleanText = text
      if (period) {
        cleanText = cleanText.replace(new RegExp(period, 'g'), '')
      }
      if (date) {
        cleanText = cleanText.replace(/\d{4}[-年/]\d{1,2}[-月/]\d{1,2}[日]?/g, '')
      }
      
      // 提取所有1-33之间的数字（红球范围）和1-16之间的数字（蓝球范围）
      const allNumbers = cleanText.match(/\b(\d{1,2})\b/g) || []
      
      // 筛选出可能的红球（1-33）和蓝球（1-16）
      const redCandidates = allNumbers
        .map(n => parseInt(n))
        .filter(n => n >= 1 && n <= 33)
        .slice(0, 6)
      
      const blueCandidates = allNumbers
        .map(n => parseInt(n))
        .filter(n => n >= 1 && n <= 16)
        .slice(-1)

      // 如果找到6个红球和1个蓝球
      if (redCandidates.length >= 6 && blueCandidates.length >= 1) {
        const redBalls = redCandidates.slice(0, 6).map(n => n.toString().padStart(2, '0'))
        const blueBall = blueCandidates[0].toString().padStart(2, '0')

        if (period) {
          return {
            period,
            date: date || new Date().toISOString().split('T')[0], // 如果没有日期，使用今天
            redBalls,
            blueBall,
          }
        }
      }

      // 如果上面的方法失败，尝试简单方法：取前6个数字作为红球，最后一个作为蓝球
      if (allNumbers.length >= 7) {
        const redBalls = allNumbers.slice(0, 6).map((n: string) => {
          const num = parseInt(n)
          return (num >= 1 && num <= 33 ? num : Math.min(33, Math.max(1, num))).toString().padStart(2, '0')
        })
        const blueNum = parseInt(allNumbers[allNumbers.length - 1])
        const blueBall = (blueNum >= 1 && blueNum <= 16 ? blueNum : Math.min(16, Math.max(1, blueNum))).toString().padStart(2, '0')

        if (period) {
          return {
            period,
            date: date || new Date().toISOString().split('T')[0],
            redBalls,
            blueBall,
          }
        }
      }

      return null
    } catch (error) {
      logger.debug('解析文本失败', 'LotteryCrawler.ParseText', {
        error: error instanceof Error ? error.message : String(error),
        textPreview: text.substring(0, 200)
      })
      return null
    }
  }

  /**
   * 提取期号
   */
  private extractPeriod(text: string): string {
    const match = text.match(/(\d{4,7})/)
    return match ? match[1] : ''
  }

  /**
   * 提取日期
   */
  private extractDate(text: string): string {
    // 尝试多种日期格式
    const patterns = [
      /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/,
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{4})\/(\d{2})\/(\d{2})/,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
      }
    }

    return ''
  }

  /**
   * 解析相对URL为绝对URL
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    if (url.startsWith('/')) {
      return `https://www.cwl.gov.cn${url}`
    }
    return `${this.baseUrl}${url}`
  }
}

