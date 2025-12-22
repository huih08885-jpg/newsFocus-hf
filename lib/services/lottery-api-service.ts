/**
 * 彩票API服务（接口盒子）
 * 使用第三方API获取开奖结果，作为爬虫的替代方案
 * API文档：https://www.apihz.cn/api/caipiaoshuangseqiu.html
 */

import { logger } from '@/lib/utils/logger'
import { LotteryResult } from './lottery-crawler'

export interface APILotteryResult {
  number: string // 开奖号码，格式：08|11|16|25|29|32|03
  number1: string // 蓝球号码
  qihao: string // 期号
  time: string // 开奖日期，格式：2024-09-26(四)
  no1num?: string // 一等奖中奖注数
  no2num?: string // 二等奖中奖注数
  no3num?: string // 三等奖中奖注数
  no4num?: string // 四等奖中奖注数
  no5num?: string // 五等奖中奖注数
  no6num?: string // 六等奖中奖注数
  no1money?: string // 一等奖奖金
  no2money?: string // 二等奖奖金
  no3money?: string // 三等奖奖金
  no4money?: string // 四等奖奖金
  no5money?: string // 五等奖奖金
  no6money?: string // 六等奖奖金
  name?: string // 彩票名称
  xiaoshou?: string // 销售额
  jiangchi?: string // 奖池金额
  no1msg?: string // 一等奖中奖地域
  code: number // 状态码，200表示成功
  msg?: string // 信息提示
}

export interface APIResponse {
  code: number
  msg?: string
  data?: APILotteryResult
}

export class LotteryAPIService {
  private baseUrl = 'https://cn.apihz.cn/api/caipiao/shuangseqiu.php'
  private apiId: string
  private apiKey: string

  constructor() {
    // 直接使用配置的API凭证
    this.apiId = '10011276'
    this.apiKey = '729055c5d73f0c18718bca2c5b8ee611'
  }

  /**
   * 检查API配置是否完整
   */
  isConfigured(): boolean {
    // API凭证已直接配置在代码中，始终返回true
    return true
  }

  /**
   * 获取最新开奖结果
   */
  async getLatestResult(): Promise<LotteryResult | null> {
    if (!this.isConfigured()) {
      logger.warn('API未配置，无法使用API服务', 'LotteryAPIService')
      return null
    }

    try {
      const url = `${this.baseUrl}?id=${encodeURIComponent(this.apiId)}&key=${encodeURIComponent(this.apiKey)}`
      
      logger.debug('调用API获取最新开奖结果', 'LotteryAPIService', { url: this.baseUrl })
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        // 设置超时
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: APILotteryResult = await response.json()

      if (data.code !== 200) {
        logger.warn('API返回错误', 'LotteryAPIService', {
          code: data.code,
          msg: data.msg
        })
        return null
      }

      // 解析数据
      const result = this.parseResult(data)
      
      logger.info('API获取成功', 'LotteryAPIService', {
        period: result.period,
        date: result.date
      })

      return result
    } catch (error) {
      logger.error('API调用失败', error instanceof Error ? error : new Error(String(error)), 'LotteryAPIService', {
        apiId: this.apiId ? '已配置' : '未配置',
        apiKey: this.apiKey ? '已配置' : '未配置'
      })
      return null
    }
  }

  /**
   * 获取指定期号的开奖结果
   */
  async getResultByPeriod(period: string): Promise<LotteryResult | null> {
    if (!this.isConfigured()) {
      logger.warn('API未配置，无法使用API服务', 'LotteryAPIService')
      return null
    }

    try {
      const url = `${this.baseUrl}?id=${encodeURIComponent(this.apiId)}&key=${encodeURIComponent(this.apiKey)}&qh=${encodeURIComponent(period)}`
      
      logger.debug('调用API获取指定期号开奖结果', 'LotteryAPIService', { period })
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: APILotteryResult = await response.json()

      if (data.code !== 200) {
        logger.warn('API返回错误', 'LotteryAPIService', {
          code: data.code,
          msg: data.msg,
          period
        })
        return null
      }

      const result = this.parseResult(data)
      
      logger.info('API获取成功', 'LotteryAPIService', {
        period: result.period,
        date: result.date
      })

      return result
    } catch (error) {
      logger.error('API调用失败', error instanceof Error ? error : new Error(String(error)), 'LotteryAPIService', {
        period
      })
      return null
    }
  }

  /**
   * 解析API返回的数据
   */
  private parseResult(data: APILotteryResult): LotteryResult {
    // 解析开奖号码：格式为 "08|11|16|25|29|32|03"
    // 前6个是红球，最后1个是蓝球
    const numbers = data.number.split('|')
    const redBalls = numbers.slice(0, 6).map(n => {
      const num = parseInt(n.trim())
      return num.toString().padStart(2, '0')
    })
    const blueBall = numbers[6]?.trim() 
      ? parseInt(numbers[6].trim()).toString().padStart(2, '0')
      : data.number1?.trim() 
        ? parseInt(data.number1.trim()).toString().padStart(2, '0')
        : '01'

    // 解析日期：格式为 "2024-09-26(四)"
    const dateStr = data.time.split('(')[0] // 提取日期部分

    return {
      period: data.qihao,
      date: dateStr,
      redBalls,
      blueBall,
      metadata: {
        source: 'apihz',
        no1num: data.no1num,
        no2num: data.no2num,
        no3num: data.no3num,
        no4num: data.no4num,
        no5num: data.no5num,
        no6num: data.no6num,
        no1money: data.no1money,
        no2money: data.no2money,
        no3money: data.no3money,
        no4money: data.no4money,
        no5money: data.no5money,
        no6money: data.no6money,
        xiaoshou: data.xiaoshou,
        jiangchi: data.jiangchi,
        no1msg: data.no1msg,
      }
    }
  }
}

