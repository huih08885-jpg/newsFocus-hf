/**
 * 彩票预测结果评估服务
 * 业务逻辑：评估预测质量，分析预测失败原因，提供改进建议
 * 技术实现：对比预测结果和实际开奖结果，计算各项指标
 */

import { calculatePrizeLevel } from '@/lib/utils/lottery-period'
import { logger } from '@/lib/utils/logger'
import { PredictionResult } from './lottery-predictor'
import { LotteryResult } from './lottery-crawler'

export interface EvaluationResult {
  accuracy: number        // 准确率（命中号码数/总号码数）
  prizeLevel: string      // 中奖等级
  score: number          // 综合得分
  improvement: number    // 相比平均水平的提升
  redBallsHit: number   // 红球命中数
  blueBallHit: number   // 蓝球是否命中
  details: {
    redBallsMatched: string[]  // 命中的红球
    redBallsMissed: string[]   // 未命中的红球
    blueBallMatched: boolean   // 蓝球是否命中
  }
}

export interface FailureAnalysis {
  reason: string
  suggestions: string[]
  category: 'number_selection' | 'distribution' | 'pattern' | 'strategy'
}

export class LotteryPredictionEvaluator {
  /**
   * 评估预测质量
   */
  evaluate(
    prediction: PredictionResult,
    actualResult: LotteryResult
  ): EvaluationResult {
    // 计算红球命中数
    const redBallsMatched = prediction.redBalls.filter(b => actualResult.redBalls.includes(b))
    const redBallsHit = redBallsMatched.length
    const redBallsMissed = prediction.redBalls.filter(b => !actualResult.redBalls.includes(b))

    // 计算蓝球是否命中
    const blueBallHit = prediction.blueBall === actualResult.blueBall ? 1 : 0
    const blueBallMatched = prediction.blueBall === actualResult.blueBall

    // 计算中奖等级
    const prizeInfo = calculatePrizeLevel(
      prediction.redBalls,
      prediction.blueBall,
      actualResult.redBalls,
      actualResult.blueBall
    )

    // 计算准确率（命中号码数/总号码数）
    const accuracy = (redBallsHit + blueBallHit) / 7

    // 计算综合得分
    const score = this.calculateScore(redBallsHit, blueBallHit, prizeInfo.prizeLevel)

    // 计算相比平均水平的提升（简化计算，实际应该基于历史数据）
    const improvement = this.calculateImprovement(accuracy, prizeInfo.prizeLevel)

    return {
      accuracy,
      prizeLevel: prizeInfo.prizeLevel,
      score,
      improvement,
      redBallsHit,
      blueBallHit,
      details: {
        redBallsMatched,
        redBallsMissed,
        blueBallMatched,
      }
    }
  }

  /**
   * 分析预测失败原因
   */
  analyzeFailure(
    prediction: PredictionResult,
    actualResult: LotteryResult,
    evaluation: EvaluationResult
  ): FailureAnalysis {
    const suggestions: string[] = []
    let reason = ''
    let category: FailureAnalysis['category'] = 'number_selection'

    // 如果未中奖
    if (evaluation.prizeLevel === '0') {
      // 分析红球命中情况
      if (evaluation.redBallsHit <= 2) {
        reason = '红球命中数过少，号码选择偏差较大'
        category = 'number_selection'
        suggestions.push('考虑调整热号、冷号的权重比例')
        suggestions.push('增加对遗漏值的关注')
        suggestions.push('检查号码分布是否合理')
      } else if (evaluation.redBallsHit >= 3 && evaluation.redBallsHit <= 4) {
        reason = '红球命中数中等，接近中奖但未达到'
        category = 'number_selection'
        suggestions.push('优化号码组合，提高命中率')
        suggestions.push('考虑使用更平衡的号码分布')
      }

      // 分析蓝球命中情况
      if (!evaluation.details.blueBallMatched) {
        reason += '；蓝球未命中'
        suggestions.push('优化蓝球选择策略')
        suggestions.push('关注蓝球的历史出现频率')
      }

      // 分析号码分布
      const distributionIssue = this.analyzeDistribution(prediction, actualResult)
      if (distributionIssue) {
        reason += `；${distributionIssue}`
        category = 'distribution'
        suggestions.push('调整号码区间分布')
        suggestions.push('优化奇偶比和大小比')
      }
    } else {
      // 如果中奖了，分析可以改进的地方
      reason = `已中${this.getPrizeLevelName(evaluation.prizeLevel)}，但仍有改进空间`
      category = 'strategy'
      
      if (evaluation.redBallsHit < 6) {
        suggestions.push('进一步提高红球命中率')
      }
      if (!evaluation.details.blueBallMatched && evaluation.prizeLevel !== '1') {
        suggestions.push('优化蓝球选择，争取更高奖级')
      }
    }

    return {
      reason: reason || '预测结果需要优化',
      suggestions: suggestions.length > 0 ? suggestions : ['继续优化预测策略'],
      category
    }
  }

  /**
   * 计算综合得分
   */
  private calculateScore(redBallsHit: number, blueBallHit: number, prizeLevel: string): number {
    // 基础得分：红球命中数 * 10 + 蓝球命中 * 20
    let score = redBallsHit * 10 + blueBallHit * 20

    // 中奖等级加成
    const prizeBonus: Record<string, number> = {
      '0': 0,
      '6': 10,
      '5': 20,
      '4': 30,
      '3': 50,
      '2': 80,
      '1': 100,
    }

    score += prizeBonus[prizeLevel] || 0

    return score
  }

  /**
   * 计算相比平均水平的提升
   */
  private calculateImprovement(accuracy: number, prizeLevel: string): number {
    // 简化计算：假设平均准确率为0.3（约2个号码命中）
    const avgAccuracy = 0.3
    const improvement = (accuracy - avgAccuracy) / avgAccuracy

    // 中奖等级加成
    if (prizeLevel !== '0') {
      return improvement + 0.5
    }

    return improvement
  }

  /**
   * 分析号码分布问题
   */
  private analyzeDistribution(
    prediction: PredictionResult,
    actualResult: LotteryResult
  ): string | null {
    // 分析区间分布
    const predZones = this.getZoneDistribution(prediction.redBalls)
    const actualZones = this.getZoneDistribution(actualResult.redBalls)

    const zoneDiff = Math.abs(predZones.zone1 - actualZones.zone1) +
                     Math.abs(predZones.zone2 - actualZones.zone2) +
                     Math.abs(predZones.zone3 - actualZones.zone3)

    if (zoneDiff > 3) {
      return '号码区间分布偏差较大'
    }

    // 分析奇偶比
    const predOddEven = this.getOddEvenRatio(prediction.redBalls)
    const actualOddEven = this.getOddEvenRatio(actualResult.redBalls)

    if (Math.abs(predOddEven.odd - actualOddEven.odd) > 2) {
      return '奇偶比偏差较大'
    }

    return null
  }

  /**
   * 获取区间分布
   */
  private getZoneDistribution(redBalls: string[]): { zone1: number; zone2: number; zone3: number } {
    const zones = { zone1: 0, zone2: 0, zone3: 0 }
    
    redBalls.forEach(ball => {
      const num = parseInt(ball)
      if (num >= 1 && num <= 11) zones.zone1++
      else if (num >= 12 && num <= 22) zones.zone2++
      else if (num >= 23 && num <= 33) zones.zone3++
    })

    return zones
  }

  /**
   * 获取奇偶比
   */
  private getOddEvenRatio(redBalls: string[]): { odd: number; even: number } {
    let odd = 0
    let even = 0

    redBalls.forEach(ball => {
      const num = parseInt(ball)
      if (num % 2 === 0) even++
      else odd++
    })

    return { odd, even }
  }

  /**
   * 获取奖级名称
   */
  private getPrizeLevelName(prizeLevel: string): string {
    const names: Record<string, string> = {
      '0': '未中奖',
      '1': '一等奖',
      '2': '二等奖',
      '3': '三等奖',
      '4': '四等奖',
      '5': '五等奖',
      '6': '六等奖',
    }
    return names[prizeLevel] || '未知'
  }
}

