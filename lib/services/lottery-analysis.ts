/**
 * 福利彩票数据分析服务
 * 提供频率分析、遗漏值分析、分布分析、模式识别等功能
 */

import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'

export interface FrequencyAnalysis {
  redBalls: Array<{ number: string; frequency: number; lastAppeared: number }>
  blueBalls: Array<{ number: string; frequency: number; lastAppeared: number }>
  hotNumbers: string[] // 热号（高频）
  coldNumbers: string[] // 冷号（低频）
  warmNumbers: string[] // 温号（中频）
}

export interface OmissionAnalysis {
  redBalls: Array<{ number: string; omission: number; maxOmission: number }>
  blueBalls: Array<{ number: string; omission: number; maxOmission: number }>
  highOmission: string[] // 高遗漏号码
  lowOmission: string[] // 低遗漏号码
}

export interface DistributionAnalysis {
  zoneDistribution: {
    zone1: number // 1-11
    zone2: number // 12-22
    zone3: number // 23-33
  }
  oddEvenRatio: {
    odd: number
    even: number
  }
  sizeRatio: {
    small: number // 1-16
    large: number // 17-33
  }
  sumRange: {
    min: number
    max: number
    average: number
  }
  spanRange: {
    min: number
    max: number
    average: number
  }
}

export interface PatternAnalysis {
  consecutiveNumbers: {
    frequency: number
    patterns: Array<{ numbers: string[]; count: number }>
  }
  periodicPatterns: Array<{
    numbers: string[]
    period: number
    confidence: number
  }>
  combinationPatterns: Array<{
    numbers: string[]
    frequency: number
  }>
  // 增强特征：组合模式
  consecutivePairs: Array<{ numbers: string[]; frequency: number }>  // 相邻号码组合
  tripleConsecutive: Array<{ numbers: string[]; frequency: number }>  // 三连号组合
  sameTailNumbers: Array<{ numbers: string[]; frequency: number }>      // 同尾号组合
  spanPatterns: Array<{ span: number; frequency: number }>            // 跨度组合
  // 增强特征：周期性规律
  weekdayPattern: Record<string, number[]>  // 星期规律
  monthPattern: Record<string, number[]>     // 月份规律
  periodPattern: Array<{ period: number; numbers: string[] }>  // 期数规律
}

export interface ComprehensiveAnalysis {
  frequency: FrequencyAnalysis
  omission: OmissionAnalysis
  distribution: DistributionAnalysis
  patterns: PatternAnalysis
  totalPeriods: number
}

export class LotteryAnalysisService {
  /**
   * 获取历史数据
   */
  private async getHistoryData(periods: number = 100) {
    const results = await prisma.lotteryResult.findMany({
      orderBy: { date: 'desc' },
      take: periods,
    })

    return results.reverse() // 按时间正序排列
  }

  /**
   * 频率分析
   * 业务逻辑：统计每个号码在最近N期中的出现频率，识别热号、冷号、温号
   * 技术实现：遍历历史数据，统计每个号码的出现次数，按频率排序
   */
  async analyzeFrequency(periods: number = 100): Promise<FrequencyAnalysis> {
    const results = await this.getHistoryData(periods)
    
    // 统计红球频率
    const redBallCount: Record<string, { count: number; lastAppeared: number }> = {}
    for (let i = 1; i <= 33; i++) {
      const num = i.toString().padStart(2, '0')
      redBallCount[num] = { count: 0, lastAppeared: -1 }
    }

    // 统计蓝球频率
    const blueBallCount: Record<string, { count: number; lastAppeared: number }> = {}
    for (let i = 1; i <= 16; i++) {
      const num = i.toString().padStart(2, '0')
      blueBallCount[num] = { count: 0, lastAppeared: -1 }
    }

    // 遍历历史数据统计
    results.forEach((result, index) => {
      result.redBalls.forEach(ball => {
        if (redBallCount[ball]) {
          redBallCount[ball].count++
          if (redBallCount[ball].lastAppeared === -1) {
            redBallCount[ball].lastAppeared = results.length - index - 1
          }
        }
      })

      if (blueBallCount[result.blueBall]) {
        blueBallCount[result.blueBall].count++
        if (blueBallCount[result.blueBall].lastAppeared === -1) {
          blueBallCount[result.blueBall].lastAppeared = results.length - index - 1
        }
      }
    })

    // 转换为数组并排序
    const redBalls = Object.entries(redBallCount)
      .map(([number, data]) => ({
        number,
        frequency: data.count,
        lastAppeared: data.lastAppeared === -1 ? periods : data.lastAppeared
      }))
      .sort((a, b) => b.frequency - a.frequency)

    const blueBalls = Object.entries(blueBallCount)
      .map(([number, data]) => ({
        number,
        frequency: data.count,
        lastAppeared: data.lastAppeared === -1 ? periods : data.lastAppeared
      }))
      .sort((a, b) => b.frequency - a.frequency)

    // 分类：热号（前30%）、冷号（后30%）、温号（中间40%）
    const redHotCount = Math.ceil(redBalls.length * 0.3)
    const redColdCount = Math.ceil(redBalls.length * 0.3)
    const hotNumbers = redBalls.slice(0, redHotCount).map(b => b.number)
    const coldNumbers = redBalls.slice(-redColdCount).map(b => b.number)
    const warmNumbers = redBalls.slice(redHotCount, -redColdCount).map(b => b.number)

    return {
      redBalls,
      blueBalls,
      hotNumbers,
      coldNumbers,
      warmNumbers
    }
  }

  /**
   * 遗漏值分析
   * 业务逻辑：计算每个号码距离上次出现的期数，识别长期未出现的号码（可能回补）
   * 技术实现：遍历历史数据，记录每个号码最后出现的期数，计算遗漏值
   */
  async analyzeOmission(periods: number = 100): Promise<OmissionAnalysis> {
    const results = await this.getHistoryData(periods)
    
    // 记录每个号码最后出现的期数
    const redBallLastAppeared: Record<string, number> = {}
    const blueBallLastAppeared: Record<string, number> = {}
    const redBallMaxOmission: Record<string, number> = {}
    const blueBallMaxOmission: Record<string, number> = {}

    // 初始化
    for (let i = 1; i <= 33; i++) {
      const num = i.toString().padStart(2, '0')
      redBallLastAppeared[num] = -1
      redBallMaxOmission[num] = 0
    }
    for (let i = 1; i <= 16; i++) {
      const num = i.toString().padStart(2, '0')
      blueBallLastAppeared[num] = -1
      blueBallMaxOmission[num] = 0
    }

    // 遍历历史数据，计算遗漏值
    results.forEach((result, index) => {
      // 更新红球遗漏
      Object.keys(redBallLastAppeared).forEach(num => {
        if (result.redBalls.includes(num)) {
          if (redBallLastAppeared[num] !== -1) {
            const omission = index - redBallLastAppeared[num]
            redBallMaxOmission[num] = Math.max(redBallMaxOmission[num], omission)
          }
          redBallLastAppeared[num] = index
        }
      })

      // 更新蓝球遗漏
      if (blueBallLastAppeared[result.blueBall] !== -1) {
        const omission = index - blueBallLastAppeared[result.blueBall]
        blueBallMaxOmission[result.blueBall] = Math.max(blueBallMaxOmission[result.blueBall], omission)
      }
      blueBallLastAppeared[result.blueBall] = index
    })

    // 计算当前遗漏值
    const currentPeriod = results.length - 1
    const redBalls = Object.keys(redBallLastAppeared).map(number => {
      const lastAppeared = redBallLastAppeared[number]
      const omission = lastAppeared === -1 ? currentPeriod + 1 : currentPeriod - lastAppeared
      return {
        number,
        omission,
        maxOmission: redBallMaxOmission[number]
      }
    }).sort((a, b) => b.omission - a.omission)

    const blueBalls = Object.keys(blueBallLastAppeared).map(number => {
      const lastAppeared = blueBallLastAppeared[number]
      const omission = lastAppeared === -1 ? currentPeriod + 1 : currentPeriod - lastAppeared
      return {
        number,
        omission,
        maxOmission: blueBallMaxOmission[number]
      }
    }).sort((a, b) => b.omission - a.omission)

    // 高遗漏（前30%）和低遗漏（后30%）
    const highOmissionCount = Math.ceil(redBalls.length * 0.3)
    const highOmission = redBalls.slice(0, highOmissionCount).map(b => b.number)
    const lowOmission = redBalls.slice(-highOmissionCount).map(b => b.number)

    return {
      redBalls,
      blueBalls,
      highOmission,
      lowOmission
    }
  }

  /**
   * 分布分析
   * 业务逻辑：分析号码的分布特征（区间、奇偶、大小、和值、跨度），识别分布规律
   * 技术实现：统计每期的分布特征，计算平均值和范围
   */
  async analyzeDistribution(periods: number = 100): Promise<DistributionAnalysis> {
    const results = await this.getHistoryData(periods)
    
    const zoneDistribution = { zone1: 0, zone2: 0, zone3: 0 }
    const oddEvenRatio = { odd: 0, even: 0 }
    const sizeRatio = { small: 0, large: 0 }
    const sums: number[] = []
    const spans: number[] = []

    results.forEach(result => {
      const redBalls = result.redBalls.map(b => parseInt(b))
      
      // 区间分布
      redBalls.forEach(num => {
        if (num >= 1 && num <= 11) zoneDistribution.zone1++
        else if (num >= 12 && num <= 22) zoneDistribution.zone2++
        else if (num >= 23 && num <= 33) zoneDistribution.zone3++
      })

      // 奇偶比
      redBalls.forEach(num => {
        if (num % 2 === 0) oddEvenRatio.even++
        else oddEvenRatio.odd++
      })

      // 大小比
      redBalls.forEach(num => {
        if (num <= 16) sizeRatio.small++
        else sizeRatio.large++
      })

      // 和值
      const sum = redBalls.reduce((a, b) => a + b, 0)
      sums.push(sum)

      // 跨度
      const span = Math.max(...redBalls) - Math.min(...redBalls)
      spans.push(span)
    })

    // 计算平均值
    const sumAvg = sums.reduce((a, b) => a + b, 0) / sums.length
    const spanAvg = spans.reduce((a, b) => a + b, 0) / spans.length

    return {
      zoneDistribution: {
        zone1: zoneDistribution.zone1 / results.length,
        zone2: zoneDistribution.zone2 / results.length,
        zone3: zoneDistribution.zone3 / results.length
      },
      oddEvenRatio: {
        odd: oddEvenRatio.odd / (results.length * 6),
        even: oddEvenRatio.even / (results.length * 6)
      },
      sizeRatio: {
        small: sizeRatio.small / (results.length * 6),
        large: sizeRatio.large / (results.length * 6)
      },
      sumRange: {
        min: Math.min(...sums),
        max: Math.max(...sums),
        average: sumAvg
      },
      spanRange: {
        min: Math.min(...spans),
        max: Math.max(...spans),
        average: spanAvg
      }
    }
  }

  /**
   * 模式识别
   * 业务逻辑：识别连号、周期性模式、组合模式等，用于预测
   * 技术实现：遍历历史数据，统计连号频率，识别周期性出现模式
   */
  async identifyPatterns(periods: number = 100): Promise<PatternAnalysis> {
    const results = await this.getHistoryData(periods)
    
    // 连号分析
    const consecutiveCount: Record<string, number> = {}
    let totalConsecutive = 0

    results.forEach(result => {
      const redBalls = result.redBalls.map(b => parseInt(b)).sort((a, b) => a - b)
      
      for (let i = 0; i < redBalls.length - 1; i++) {
        if (redBalls[i + 1] - redBalls[i] === 1) {
          totalConsecutive++
          const key = `${redBalls[i].toString().padStart(2, '0')}-${redBalls[i + 1].toString().padStart(2, '0')}`
          consecutiveCount[key] = (consecutiveCount[key] || 0) + 1
        }
      }
    })

    const consecutivePatterns = Object.entries(consecutiveCount)
      .map(([numbers, count]) => ({
        numbers: numbers.split('-'),
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 周期性模式（简化版：识别号码的周期性出现）
    const periodicPatterns: Array<{ numbers: string[]; period: number; confidence: number }> = []
    // 这里简化实现，实际可以更复杂

    // 组合模式（统计常见的号码组合）
    const combinationCount: Record<string, number> = {}
    results.forEach(result => {
      const sorted = [...result.redBalls].sort()
      const key = sorted.join('-')
      combinationCount[key] = (combinationCount[key] || 0) + 1
    })

    const combinationPatterns = Object.entries(combinationCount)
      .filter(([_, count]) => count > 1)
      .map(([numbers, frequency]) => ({
        numbers: numbers.split('-'),
        frequency
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)

    // 增强特征：相邻号码组合（如：01-02, 05-06）
    const consecutivePairs: Record<string, number> = {}
    results.forEach(result => {
      const redBalls = result.redBalls.map(b => parseInt(b)).sort((a, b) => a - b)
      for (let i = 0; i < redBalls.length - 1; i++) {
        const pair = [redBalls[i], redBalls[i + 1]]
          .map(n => n.toString().padStart(2, '0'))
          .sort()
        const key = pair.join('-')
        consecutivePairs[key] = (consecutivePairs[key] || 0) + 1
      }
    })

    // 增强特征：三连号组合（如：01-02-03）
    const tripleConsecutive: Record<string, number> = {}
    results.forEach(result => {
      const redBalls = result.redBalls.map(b => parseInt(b)).sort((a, b) => a - b)
      for (let i = 0; i < redBalls.length - 2; i++) {
        if (redBalls[i + 1] - redBalls[i] === 1 && redBalls[i + 2] - redBalls[i + 1] === 1) {
          const triple = [redBalls[i], redBalls[i + 1], redBalls[i + 2]]
            .map(n => n.toString().padStart(2, '0'))
            .sort()
          const key = triple.join('-')
          tripleConsecutive[key] = (tripleConsecutive[key] || 0) + 1
        }
      }
    })

    // 增强特征：同尾号组合（如：01-11-21）
    const sameTailNumbers: Record<string, number> = {}
    results.forEach(result => {
      const tailGroups: Record<string, string[]> = {}
      result.redBalls.forEach(ball => {
        const tail = ball.slice(-1)
        if (!tailGroups[tail]) tailGroups[tail] = []
        tailGroups[tail].push(ball)
      })
      Object.values(tailGroups).forEach(group => {
        if (group.length >= 2) {
          const key = group.sort().join('-')
          sameTailNumbers[key] = (sameTailNumbers[key] || 0) + 1
        }
      })
    })

    // 增强特征：跨度组合（最大号-最小号）
    const spanPatterns: Record<number, number> = {}
    results.forEach(result => {
      const redBalls = result.redBalls.map(b => parseInt(b))
      const span = Math.max(...redBalls) - Math.min(...redBalls)
      spanPatterns[span] = (spanPatterns[span] || 0) + 1
    })

    // 增强特征：周期性规律 - 星期规律
    const weekdayPattern: Record<string, number[]> = {}
    results.forEach(result => {
      const weekday = new Date(result.date).getDay().toString()
      if (!weekdayPattern[weekday]) weekdayPattern[weekday] = []
      result.redBalls.forEach(ball => {
        const num = parseInt(ball)
        if (!weekdayPattern[weekday].includes(num)) {
          weekdayPattern[weekday].push(num)
        }
      })
    })

    // 增强特征：周期性规律 - 月份规律
    const monthPattern: Record<string, number[]> = {}
    results.forEach(result => {
      const month = (new Date(result.date).getMonth() + 1).toString()
      if (!monthPattern[month]) monthPattern[month] = []
      result.redBalls.forEach(ball => {
        const num = parseInt(ball)
        if (!monthPattern[month].includes(num)) {
          monthPattern[month].push(num)
        }
      })
    })

    // 增强特征：期数规律（每N期出现一次）
    const periodPattern: Array<{ period: number; numbers: string[] }> = []
    // 简化实现：识别最近出现的号码组合
    if (results.length >= 10) {
      const recentNumbers = new Set<string>()
      results.slice(-10).forEach(result => {
        result.redBalls.forEach(ball => recentNumbers.add(ball))
      })
      periodPattern.push({
        period: 10,
        numbers: Array.from(recentNumbers).slice(0, 6)
      })
    }

    return {
      consecutiveNumbers: {
        frequency: totalConsecutive / results.length,
        patterns: consecutivePatterns
      },
      periodicPatterns,
      combinationPatterns,
      consecutivePairs: Object.entries(consecutivePairs)
        .map(([numbers, frequency]) => ({
          numbers: numbers.split('-'),
          frequency
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20),
      tripleConsecutive: Object.entries(tripleConsecutive)
        .map(([numbers, frequency]) => ({
          numbers: numbers.split('-'),
          frequency
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      sameTailNumbers: Object.entries(sameTailNumbers)
        .map(([numbers, frequency]) => ({
          numbers: numbers.split('-'),
          frequency
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      spanPatterns: Object.entries(spanPatterns)
        .map(([span, frequency]) => ({
          span: parseInt(span),
          frequency
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      weekdayPattern,
      monthPattern,
      periodPattern
    }
  }

  /**
   * 综合分析
   * 业务逻辑：整合所有分析结果，为预测提供全面的数据支持
   * 技术实现：调用所有分析方法，汇总结果
   */
  async comprehensiveAnalysis(periods: number = 100): Promise<ComprehensiveAnalysis> {
    logger.info(`开始综合分析，使用最近 ${periods} 期数据`, 'LotteryAnalysis', { periods })

    const [frequency, omission, distribution, patterns] = await Promise.all([
      this.analyzeFrequency(periods),
      this.analyzeOmission(periods),
      this.analyzeDistribution(periods),
      this.identifyPatterns(periods)
    ])

    logger.info('综合分析完成', 'LotteryAnalysis', {
      hotNumbers: frequency.hotNumbers.length,
      coldNumbers: frequency.coldNumbers.length,
      highOmission: omission.highOmission.length
    })

    return {
      frequency,
      omission,
      distribution,
      patterns,
      totalPeriods: periods
    }
  }
}

