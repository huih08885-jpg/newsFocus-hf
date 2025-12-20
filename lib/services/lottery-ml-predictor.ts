/**
 * 福利彩票机器学习预测服务
 * 业务逻辑：使用机器学习模型分析历史数据，预测下一期号码出现的概率
 * 技术实现：提取特征（频率、遗漏、分布等），使用简单的概率模型和统计方法进行预测
 * 
 * 注意：由于彩票的随机性，这里使用简化的统计学习方法，而非复杂的深度学习模型
 */

import { ComprehensiveAnalysis } from './lottery-analysis'
import { logger } from '@/lib/utils/logger'

export interface MLPrediction {
  redBalls: string[]
  blueBall: string
  confidence: number
  probability: number // 整体中奖概率（估算）
  features: {
    hotScore: number // 热号得分
    omissionScore: number // 遗漏得分
    distributionScore: number // 分布得分
  }
}

export interface MLPredictionResult {
  predictions: MLPrediction[]
  featureImportance: Record<string, number>
}

export class LotteryMLPredictor {
  /**
   * 提取特征向量
   * 业务逻辑：将每个号码的特征（频率、遗漏、分布等）转换为数值特征，供模型使用
   * 技术实现：计算每个号码的多个特征值，归一化后组成特征向量
   */
  private extractFeatures(
    number: string,
    analysis: ComprehensiveAnalysis
  ): {
    frequency: number // 频率特征（归一化）
    omission: number // 遗漏特征（归一化）
    zone: number // 区间特征
    isHot: number // 是否热号（0或1）
    isCold: number // 是否冷号（0或1）
    highOmission: number // 是否高遗漏（0或1）
  } {
    const num = parseInt(number)
    
    // 频率特征
    const freqData = analysis.frequency.redBalls.find(b => b.number === number)
    const maxFreq = Math.max(...analysis.frequency.redBalls.map(b => b.frequency))
    const frequency = freqData ? freqData.frequency / maxFreq : 0

    // 遗漏特征
    const omitData = analysis.omission.redBalls.find(b => b.number === number)
    const maxOmission = Math.max(...analysis.omission.redBalls.map(b => b.omission))
    const omission = omitData ? omitData.omission / maxOmission : 0

    // 区间特征（归一化到0-1）
    let zone = 0
    if (num >= 1 && num <= 11) zone = 0.33
    else if (num >= 12 && num <= 22) zone = 0.66
    else if (num >= 23 && num <= 33) zone = 1.0

    // 是否热号/冷号/高遗漏
    const isHot = analysis.frequency.hotNumbers.includes(number) ? 1 : 0
    const isCold = analysis.frequency.coldNumbers.includes(number) ? 1 : 0
    const highOmission = analysis.omission.highOmission.includes(number) ? 1 : 0

    return {
      frequency,
      omission,
      zone,
      isHot,
      isCold,
      highOmission
    }
  }

  /**
   * 计算号码出现概率
   * 业务逻辑：基于特征向量，使用加权评分模型计算每个号码出现的概率
   * 技术实现：特征加权求和，应用sigmoid函数得到概率
   */
  calculateProbability(
    number: string,
    analysis: ComprehensiveAnalysis,
    weights: {
      frequency: number
      omission: number
      hot: number
      cold: number
      highOmission: number
    } = {
      frequency: 0.3,
      omission: 0.2,
      hot: 0.2,
      cold: 0.15,
      highOmission: 0.15
    }
  ): number {
    const features = this.extractFeatures(number, analysis)
    
    // 计算加权得分
    let score = 0
    score += features.frequency * weights.frequency
    score += features.omission * weights.omission
    score += features.isHot * weights.hot
    score += features.isCold * weights.cold
    score += features.highOmission * weights.highOmission

    // 使用sigmoid函数转换为概率（0-1之间）
    const probability = 1 / (1 + Math.exp(-score * 5)) // 乘以5调整曲线陡峭度

    return probability
  }

  /**
   * 生成预测（基于概率模型）
   * 业务逻辑：根据每个号码的出现概率，选择概率较高的号码组合
   * 技术实现：计算所有号码的概率，按概率排序，选择不同策略的组合
   */
  async predict(
    analysis: ComprehensiveAnalysis,
    featureWeights?: {
      frequency: number
      omission: number
      hot: number
      cold: number
      highOmission: number
    }
  ): Promise<MLPredictionResult> {
    logger.info('开始机器学习预测', 'LotteryMLPredictor')

    // 使用传入的权重或默认权重
    const weights = featureWeights || {
      frequency: 0.3,
      omission: 0.2,
      hot: 0.2,
      cold: 0.15,
      highOmission: 0.15
    }

    // 计算所有红球的概率
    const redBallProbabilities: Array<{ number: string; probability: number; features: any }> = []
    for (let i = 1; i <= 33; i++) {
      const number = i.toString().padStart(2, '0')
      const probability = this.calculateProbability(number, analysis, weights)
      const features = this.extractFeatures(number, analysis)
      
      redBallProbabilities.push({
        number,
        probability,
        features
      })
    }

    // 计算所有蓝球的概率
    const blueBallProbabilities: Array<{ number: string; probability: number }> = []
    for (let i = 1; i <= 16; i++) {
      const number = i.toString().padStart(2, '0')
      const freqData = analysis.frequency.blueBalls.find(b => b.number === number)
      const maxFreq = Math.max(...analysis.frequency.blueBalls.map(b => b.frequency), 1)
      const probability = freqData ? freqData.frequency / maxFreq : 0.1
      
      blueBallProbabilities.push({ number, probability })
    }

    // 按概率排序
    redBallProbabilities.sort((a, b) => b.probability - a.probability)
    blueBallProbabilities.sort((a, b) => b.probability - a.probability)

    // 生成5组预测
    const predictions: MLPrediction[] = []
    const strategies = [
      { name: '保守型', weights: { frequency: 0.4, omission: 0.1, hot: 0.3, cold: 0.1, highOmission: 0.1 } },
      { name: '平衡型', weights: { frequency: 0.3, omission: 0.2, hot: 0.2, cold: 0.15, highOmission: 0.15 } },
      { name: '激进型', weights: { frequency: 0.2, omission: 0.3, hot: 0.1, cold: 0.2, highOmission: 0.2 } },
      { name: '平衡型', weights: { frequency: 0.3, omission: 0.2, hot: 0.2, cold: 0.15, highOmission: 0.15 } },
      { name: '保守型', weights: { frequency: 0.4, omission: 0.1, hot: 0.3, cold: 0.1, highOmission: 0.1 } }
    ]

    for (let i = 0; i < 5; i++) {
      const strategy = strategies[i]
      
      // 使用策略权重重新计算概率（策略权重会叠加在特征权重上）
      const strategyProbabilities = redBallProbabilities.map(item => ({
        ...item,
        probability: this.calculateProbability(item.number, analysis, {
          frequency: weights.frequency * (1 + (strategy.weights.frequency - 0.3)),
          omission: weights.omission * (1 + (strategy.weights.omission - 0.2)),
          hot: weights.hot * (1 + (strategy.weights.hot - 0.2)),
          cold: weights.cold * (1 + (strategy.weights.cold - 0.15)),
          highOmission: weights.highOmission * (1 + (strategy.weights.highOmission - 0.15))
        })
      })).sort((a, b) => b.probability - a.probability)

      // 选择6个红球（确保多样性）
      const selectedRedBalls: string[] = []
      const used = new Set<number>()

      // 前3个选择概率最高的
      for (let j = 0; j < 3 && j < strategyProbabilities.length; j++) {
        const num = parseInt(strategyProbabilities[j].number)
        if (!used.has(num)) {
          selectedRedBalls.push(strategyProbabilities[j].number)
          used.add(num)
        }
      }

      // 后3个从不同概率区间选择（增加多样性）
      const midStart = Math.floor(strategyProbabilities.length * 0.2)
      const midEnd = Math.floor(strategyProbabilities.length * 0.6)
      for (let j = midStart; j < midEnd && selectedRedBalls.length < 6; j++) {
        const num = parseInt(strategyProbabilities[j].number)
        if (!used.has(num)) {
          selectedRedBalls.push(strategyProbabilities[j].number)
          used.add(num)
        }
      }

      // 如果还不够，补充
      for (let j = 0; j < strategyProbabilities.length && selectedRedBalls.length < 6; j++) {
        const num = parseInt(strategyProbabilities[j].number)
        if (!used.has(num)) {
          selectedRedBalls.push(strategyProbabilities[j].number)
          used.add(num)
        }
      }

      // 选择蓝球
      const blueBall = blueBallProbabilities[i % blueBallProbabilities.length]?.number || '01'

      // 计算特征得分
      const hotScore = selectedRedBalls.reduce((sum, b) => {
        const features = this.extractFeatures(b, analysis)
        return sum + features.isHot
      }, 0) / selectedRedBalls.length

      const omissionScore = selectedRedBalls.reduce((sum, b) => {
        const features = this.extractFeatures(b, analysis)
        return sum + features.omission
      }, 0) / selectedRedBalls.length

      const distributionScore = this.calculateDistributionScore(selectedRedBalls, analysis)

      // 计算整体概率（简化估算）
      const avgProbability = selectedRedBalls.reduce((sum, b) => {
        const prob = strategyProbabilities.find(p => p.number === b)?.probability || 0
        return sum + prob
      }, 0) / selectedRedBalls.length

      predictions.push({
        redBalls: selectedRedBalls.sort((a, b) => parseInt(a) - parseInt(b)),
        blueBall,
        confidence: avgProbability,
        probability: avgProbability * 0.1, // 整体中奖概率估算（简化）
        features: {
          hotScore,
          omissionScore,
          distributionScore
        }
      })
    }

    // 特征重要性（基于权重）
    const featureImportance = weights

    logger.info('机器学习预测完成', 'LotteryMLPredictor', {
      predictionCount: predictions.length
    })

    return {
      predictions,
      featureImportance
    }
  }

  /**
   * 计算分布得分
   * 业务逻辑：评估号码组合的分布是否合理（区间、奇偶、大小等）
   * 技术实现：计算组合的分布特征，与历史平均分布对比，给出得分
   */
  private calculateDistributionScore(
    redBalls: string[],
    analysis: ComprehensiveAnalysis
  ): number {
    const nums = redBalls.map(b => parseInt(b))
    
    // 区间分布得分
    let zoneScore = 0
    const zoneCount = { zone1: 0, zone2: 0, zone3: 0 }
    nums.forEach(num => {
      if (num >= 1 && num <= 11) zoneCount.zone1++
      else if (num >= 12 && num <= 22) zoneCount.zone2++
      else if (num >= 23 && num <= 33) zoneCount.zone3++
    })
    // 理想分布：每个区间2个号码
    const idealZone = 2
    zoneScore = 1 - (
      Math.abs(zoneCount.zone1 - idealZone) +
      Math.abs(zoneCount.zone2 - idealZone) +
      Math.abs(zoneCount.zone3 - idealZone)
    ) / 6

    // 奇偶比得分
    const oddCount = nums.filter(n => n % 2 === 1).length
    const evenCount = nums.length - oddCount
    const oddEvenScore = 1 - Math.abs(oddCount - evenCount) / 6

    // 大小比得分
    const smallCount = nums.filter(n => n <= 16).length
    const largeCount = nums.length - smallCount
    const sizeScore = 1 - Math.abs(smallCount - largeCount) / 6

    // 综合得分
    return (zoneScore * 0.4 + oddEvenScore * 0.3 + sizeScore * 0.3)
  }
}

