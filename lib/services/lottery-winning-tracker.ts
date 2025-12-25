/**
 * 彩票中奖率追踪服务
 * 业务逻辑：追踪每种预测策略的历史中奖情况，计算中奖率，动态调整权重
 * 技术实现：从数据库读取评估记录，计算统计信息，生成最优权重
 */

import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { calculatePrizeLevel } from '@/lib/utils/lottery-period'

export interface WinningRateStats {
  total: number
  winning: number
  rate: number
  prizeDistribution: {
    level0: number // 未中奖
    level1: number // 一等奖
    level2: number // 二等奖
    level3: number // 三等奖
    level4: number // 四等奖
    level5: number // 五等奖
    level6: number // 六等奖
  }
}

export interface OptimalWeights {
  ai: number
  ml: number
  statistical: number
  // 确保总和为1
  total: number
}

export class LotteryWinningTracker {
  /**
   * 记录预测结果的中奖情况
   */
  async trackWinning(
    predictionId: string,
    actualResultId: string | null,
    actualRedBalls: string[],
    actualBlueBall: string,
    strategy: string,
    method: 'statistical' | 'ai' | 'ml' | 'comprehensive'
  ): Promise<void> {
    try {
      // 获取预测结果
      const prediction = await prisma.lotteryPrediction.findUnique({
        where: { id: predictionId },
        select: {
          redBalls: true,
          blueBall: true,
        }
      })

      if (!prediction) {
        logger.warn('预测记录不存在', 'WinningTracker', { predictionId })
        return
      }

      // 计算命中情况
      const redBallsHit = prediction.redBalls.filter(b => actualRedBalls.includes(b)).length
      const blueBallHit = prediction.blueBall === actualBlueBall ? 1 : 0

      // 计算中奖等级
      const prizeInfo = calculatePrizeLevel(
        prediction.redBalls,
        prediction.blueBall,
        actualRedBalls,
        actualBlueBall
      )

      // 计算准确率
      const accuracy = (redBallsHit + blueBallHit) / 7 // 总共7个号码

      // 计算综合得分（用于排序和优化）
      // 得分 = 准确率 * 0.4 + 中奖等级权重 * 0.6
      const prizeLevelWeight = this.getPrizeLevelWeight(prizeInfo.prizeLevel)
      const score = accuracy * 0.4 + prizeLevelWeight * 0.6

      // 保存评估记录
      await prisma.lotteryPredictionEvaluation.create({
        data: {
          predictionId,
          actualResultId,
          redBallsHit,
          blueBallHit,
          prizeLevel: prizeInfo.prizeLevel,
          accuracy,
          score,
          strategy,
          method,
        }
      })

      logger.info('已记录预测评估', 'WinningTracker', {
        predictionId,
        redBallsHit,
        blueBallHit,
        prizeLevel: prizeInfo.prizeLevel,
        accuracy,
        strategy,
        method
      })
    } catch (error) {
      logger.error('记录预测评估失败', error instanceof Error ? error : new Error(String(error)), 'WinningTracker', {
        predictionId,
        actualResultId
      })
    }
  }

  /**
   * 获取各策略的中奖率统计
   * @param periods 统计期数
   * @param userId 用户ID（可选，如果提供则只统计该用户的数据）
   */
  async getWinningRates(periods: number = 50, userId?: string): Promise<{
    statistical: WinningRateStats
    ai: WinningRateStats
    ml: WinningRateStats
    comprehensive: WinningRateStats
  }> {
    // 构建查询条件
    const where: any = {}

    // 如果提供了 userId，只统计该用户的预测评估
    if (userId) {
      where.prediction = {
        userId: userId
      }
    } else {
      // 如果没有提供 userId，查询所有评估记录（用于调试）
      logger.warn('未提供 userId，将查询所有评估记录', 'WinningTracker')
    }

    // 暂时不按日期过滤，统计所有评估记录
    // 如果需要按日期过滤，可以取消下面的注释
    // if (periods < 200) {
    //   const cutoffDate = new Date()
    //   cutoffDate.setDate(cutoffDate.getDate() - (periods * 7)) // 假设每周3期
    //   where.createdAt = {
    //     gte: cutoffDate
    //   }
    // }

    const evaluations = await prisma.lotteryPredictionEvaluation.findMany({
      where,
      select: {
        method: true,
        prizeLevel: true,
        prediction: {
          select: {
            userId: true,
            analysis: {
              select: {
                type: true
              }
            }
          }
        }
      }
    })

    logger.info('查询评估记录', 'WinningTracker', {
      userId,
      periods,
      whereCondition: JSON.stringify(where),
      evaluationsCount: evaluations.length,
      sampleEvaluations: evaluations.slice(0, 10).map(e => ({
        method: e.method,
        prizeLevel: e.prizeLevel,
        analysisType: e.prediction?.analysis?.type,
        userId: e.prediction?.userId
      })),
      prizeLevels: [...new Set(evaluations.map(e => e.prizeLevel).filter(Boolean))],
      methods: [...new Set(evaluations.map(e => e.method).filter(Boolean))]
    })

    const stats: Record<string, WinningRateStats> = {
      statistical: this.initStats(),
      ai: this.initStats(),
      ml: this.initStats(),
      comprehensive: this.initStats(),
    }

    evaluations.forEach(evaluation => {
      // 优先使用 method 字段，如果没有则使用 analysis.type
      let method = evaluation.method
      if (!method && evaluation.prediction?.analysis?.type) {
        method = evaluation.prediction.analysis.type
      }
      
      // 如果 method 为空或不在已知列表中，默认为 'comprehensive'
      if (!method || !stats[method]) {
        logger.debug('method 为空或不在已知列表中，使用 comprehensive', 'WinningTracker', {
          originalMethod: evaluation.method,
          analysisType: evaluation.prediction?.analysis?.type,
          finalMethod: 'comprehensive'
        })
        method = 'comprehensive'
      }
      
      // 确保 method 在 stats 中
      if (stats[method]) {
        stats[method].total++
        if (evaluation.prizeLevel && evaluation.prizeLevel !== '0') {
          stats[method].winning++
        }
        
        // 统计奖级分布
        const level = evaluation.prizeLevel || '0'
        const levelKey = `level${level}` as keyof WinningRateStats['prizeDistribution']
        const currentStat = stats[method]
        if (levelKey in currentStat.prizeDistribution) {
          currentStat.prizeDistribution[levelKey]++
          logger.debug('统计奖级分布', 'WinningTracker', {
            method,
            level,
            levelKey,
            prizeLevel: evaluation.prizeLevel,
            count: currentStat.prizeDistribution[levelKey]
          })
        } else {
          // 如果 levelKey 不在 prizeDistribution 中，记录警告
          logger.warn('未知的奖级', 'WinningTracker', {
            level,
            levelKey,
            method,
            prizeLevel: evaluation.prizeLevel,
            availableKeys: Object.keys(currentStat.prizeDistribution)
          })
        }
      } else {
        // 如果 method 不在 stats 中，记录警告
        logger.warn('未知的 method 值', 'WinningTracker', {
          method: evaluation.method,
          analysisType: evaluation.prediction?.analysis?.type,
          prizeLevel: evaluation.prizeLevel
        })
      }
    })
    
    logger.info('统计结果', 'WinningTracker', {
      userId,
      periods,
      stats: Object.keys(stats).map(method => ({
        method,
        total: stats[method].total,
        winning: stats[method].winning,
        rate: stats[method].rate,
        prizeDistribution: stats[method].prizeDistribution
      }))
    })

    // 计算中奖率
    Object.keys(stats).forEach(method => {
      const stat = stats[method]
      stat.rate = stat.total > 0 ? stat.winning / stat.total : 0
    })

    return {
      statistical: stats.statistical,
      ai: stats.ai,
      ml: stats.ml,
      comprehensive: stats.comprehensive,
    }
  }

  /**
   * 获取最优权重组合
   * 根据最近50期的中奖率，动态调整权重
   * @param periods 统计期数
   * @param userId 用户ID（可选，如果提供则只统计该用户的数据）
   */
  async getOptimalWeights(periods: number = 50, userId?: string): Promise<OptimalWeights> {
    const rates = await this.getWinningRates(periods, userId)

    // 基础权重
    const baseWeights = {
      ai: 0.4,
      ml: 0.3,
      statistical: 0.3,
    }

    // 计算平均中奖率
    const avgRate = (
      rates.ai.rate +
      rates.ml.rate +
      rates.statistical.rate +
      rates.comprehensive.rate
    ) / 4

    // 如果平均中奖率为0，使用基础权重
    if (avgRate === 0) {
      return {
        ...baseWeights,
        total: 1.0
      }
    }

    // 计算各策略的中奖率提升系数
    const aiBoost = (rates.ai.rate - avgRate) / avgRate
    const mlBoost = (rates.ml.rate - avgRate) / avgRate
    const statisticalBoost = (rates.statistical.rate - avgRate) / avgRate

    // 计算新权重（限制在合理范围内）
    const newWeights = {
      ai: Math.max(0.1, Math.min(0.6, baseWeights.ai * (1 + aiBoost * 0.5))),
      ml: Math.max(0.1, Math.min(0.6, baseWeights.ml * (1 + mlBoost * 0.5))),
      statistical: Math.max(0.1, Math.min(0.6, baseWeights.statistical * (1 + statisticalBoost * 0.5))),
    }

    // 归一化，确保总和为1
    const total = newWeights.ai + newWeights.ml + newWeights.statistical
    const normalized: OptimalWeights = {
      ai: newWeights.ai / total,
      ml: newWeights.ml / total,
      statistical: newWeights.statistical / total,
      total: 1.0
    }

    logger.info('计算最优权重', 'WinningTracker', {
      rates: {
        ai: rates.ai.rate,
        ml: rates.ml.rate,
        statistical: rates.statistical.rate,
        comprehensive: rates.comprehensive.rate,
      },
      weights: normalized
    })

    return normalized
  }

  /**
   * 初始化统计数据
   */
  private initStats(): WinningRateStats {
    return {
      total: 0,
      winning: 0,
      rate: 0,
      prizeDistribution: {
        level0: 0,
        level1: 0,
        level2: 0,
        level3: 0,
        level4: 0,
        level5: 0,
        level6: 0,
      }
    }
  }

  /**
   * 获取中奖等级权重（用于计算综合得分）
   */
  private getPrizeLevelWeight(prizeLevel: string): number {
    const weights: Record<string, number> = {
      '0': 0,      // 未中奖
      '6': 0.1,    // 六等奖
      '5': 0.2,    // 五等奖
      '4': 0.3,    // 四等奖
      '3': 0.5,    // 三等奖
      '2': 0.8,    // 二等奖
      '1': 1.0,    // 一等奖
    }
    return weights[prizeLevel] || 0
  }
}

