/**
 * 福利彩票综合预测服务
 * 业务逻辑：整合统计分析、AI分析、机器学习三种方法，生成最终的预测结果
 * 技术实现：调用各个预测服务，融合结果，生成5组最优预测号码
 */

import { prisma } from '@/lib/db/prisma'
import { LotteryAnalysisService, ComprehensiveAnalysis } from './lottery-analysis'
import { LotteryAIPredictor, AIPredictionResult } from './lottery-ai-predictor'
import { LotteryMLPredictor, MLPredictionResult } from './lottery-ml-predictor'
import { LotteryWinningTracker, OptimalWeights } from './lottery-winning-tracker'
import { logger } from '@/lib/utils/logger'

export interface PredictionResult {
  redBalls: string[]
  blueBall: string
  confidence: number
  strategy: string
  reasoning: string
  sources: string[] // 数据来源：statistical, ai, ml
}

export interface PredictionResponse {
  predictions: PredictionResult[]
  analysis: {
    statistical: ComprehensiveAnalysis
    ai?: AIPredictionResult
    ml: MLPredictionResult
  }
  metadata: {
    totalPeriods: number
    predictionDate: Date
    strategies: string[]
  }
}

export class LotteryPredictor {
  private analysisService: LotteryAnalysisService
  private aiPredictor: LotteryAIPredictor
  private mlPredictor: LotteryMLPredictor
  private winningTracker: LotteryWinningTracker

  constructor() {
    this.analysisService = new LotteryAnalysisService()
    this.aiPredictor = new LotteryAIPredictor()
    this.mlPredictor = new LotteryMLPredictor()
    this.winningTracker = new LotteryWinningTracker()
  }

  /**
   * 生成预测
   * 业务逻辑：综合使用统计分析、AI分析、机器学习三种方法，生成5组预测号码
   * 技术实现：并行调用各预测服务，融合结果，选择最优组合
   */
  async predict(periods: number = 100): Promise<PredictionResponse> {
    logger.info(`开始生成预测，使用最近 ${periods} 期数据`, 'LotteryPredictor', { periods })

    // 1. 获取历史数据
    const historyData = await prisma.lotteryResult.findMany({
      orderBy: { date: 'desc' },
      take: periods,
      select: {
        period: true,
        date: true,
        redBalls: true,
        blueBall: true
      }
    })

    if (historyData.length < 10) {
      throw new Error(`历史数据不足，至少需要10期数据，当前只有 ${historyData.length} 期`)
    }

    const reversedHistory = historyData.reverse() // 按时间正序

    // 2. 统计分析
    logger.info('执行统计分析', 'LotteryPredictor')
    const statisticalAnalysis = await this.analysisService.comprehensiveAnalysis(periods)

    // 3. 并行执行AI分析和机器学习预测
    logger.info('执行AI分析和机器学习预测', 'LotteryPredictor')
    const [aiResult, mlResult] = await Promise.allSettled([
      this.aiPredictor.analyzeWithLLM(reversedHistory, statisticalAnalysis).catch(err => {
        const error = err instanceof Error ? err : new Error(String(err))
        logger.warn('AI预测失败，将仅使用统计分析和机器学习', 'LotteryPredictor', { error: error.message })
        return null
      }),
      this.mlPredictor.predict(statisticalAnalysis)
    ])

    const aiPrediction = aiResult.status === 'fulfilled' ? aiResult.value : null
    const mlPrediction = mlResult.status === 'fulfilled' ? mlResult.value : null

    if (!mlPrediction) {
      throw new Error('机器学习预测失败')
    }

    // 4. 融合预测结果
    logger.info('融合预测结果', 'LotteryPredictor')
    const finalPredictions = await this.mergePredictions(
      statisticalAnalysis,
      aiPrediction,
      mlPrediction
    )

    logger.info('预测完成', 'LotteryPredictor', {
      predictionCount: finalPredictions.length,
      hasAI: !!aiPrediction,
      hasML: !!mlPrediction
    })

    return {
      predictions: finalPredictions,
      analysis: {
        statistical: statisticalAnalysis,
        ai: aiPrediction || undefined,
        ml: mlPrediction
      },
      metadata: {
        totalPeriods: periods,
        predictionDate: new Date(),
        strategies: ['统计分析', aiPrediction ? 'AI分析' : '', '机器学习'].filter(Boolean)
      }
    }
  }

  /**
   * 融合预测结果
   * 业务逻辑：将三种方法的预测结果进行融合，选择最优的5组号码
   * 技术实现：计算每组号码的综合得分，选择得分最高的5组
   */
  private async mergePredictions(
    statistical: ComprehensiveAnalysis,
    ai: AIPredictionResult | null,
    ml: MLPredictionResult
  ): Promise<PredictionResult[]> {
    // 获取动态权重（基于历史中奖率）
    let weights: OptimalWeights
    try {
      weights = await this.winningTracker.getOptimalWeights(50)
      logger.info('使用动态权重', 'LotteryPredictor', { weights })
    } catch (error) {
      logger.warn('获取动态权重失败，使用默认权重', 'LotteryPredictor', {
        error: error instanceof Error ? error.message : String(error)
      })
      // 使用默认权重
      weights = {
        ai: 0.4,
        ml: 0.3,
        statistical: 0.3,
        total: 1.0
      }
    }

    const allPredictions: Array<{
      redBalls: string[]
      blueBall: string
      confidence: number
      strategy: string
      reasoning: string
      sources: string[]
      score: number
    }> = []

    // 1. 添加AI预测（如果可用）
    if (ai && ai.predictions.length > 0) {
      ai.predictions.forEach(pred => {
        allPredictions.push({
          ...pred,
          sources: ['ai'],
          score: pred.confidence * weights.ai // 使用动态权重
        })
      })
    }

    // 2. 添加机器学习预测
    ml.predictions.forEach(pred => {
      allPredictions.push({
        redBalls: pred.redBalls,
        blueBall: pred.blueBall,
        confidence: pred.confidence,
        strategy: this.determineStrategy(pred),
        reasoning: `机器学习预测：热号得分${pred.features.hotScore.toFixed(2)}，遗漏得分${pred.features.omissionScore.toFixed(2)}，分布得分${pred.features.distributionScore.toFixed(2)}`,
        sources: ['ml'],
        score: pred.confidence * weights.ml // 使用动态权重
      })
    })

    // 3. 基于统计分析生成补充预测
    const statisticalPredictions = this.generateStatisticalPredictions(statistical)
    statisticalPredictions.forEach(pred => {
      allPredictions.push({
        ...pred,
        sources: ['statistical'],
        score: pred.confidence * weights.statistical // 使用动态权重
      })
    })

    // 4. 去重和评分优化
    const uniquePredictions = this.deduplicateAndScore(allPredictions, statistical)

    // 5. 选择最优的5组
    uniquePredictions.sort((a, b) => b.score - a.score)
    const top5 = uniquePredictions.slice(0, 5)

    // 6. 确保有5组（如果不足，补充）
    while (top5.length < 5) {
      const supplementary = this.generateSupplementaryPrediction(statistical, top5)
      // 添加 score 属性以匹配类型
      top5.push({
        ...supplementary,
        score: 0.5 // 补充预测使用较低的分数
      })
    }

    return top5.map(p => ({
      redBalls: p.redBalls,
      blueBall: p.blueBall,
      confidence: p.confidence,
      strategy: p.strategy,
      reasoning: p.reasoning,
      sources: p.sources
    }))
  }

  /**
   * 去重和重新评分
   * 业务逻辑：去除重复的号码组合，根据统计分析结果重新计算得分
   * 技术实现：使用组合的字符串作为key去重，结合频率、遗漏等重新评分
   */
  private deduplicateAndScore(
    predictions: Array<{
      redBalls: string[]
      blueBall: string
      confidence: number
      strategy: string
      reasoning: string
      sources: string[]
      score: number
    }>,
    statistical: ComprehensiveAnalysis
  ): Array<{
    redBalls: string[]
    blueBall: string
    confidence: number
    strategy: string
    reasoning: string
    sources: string[]
    score: number
  }> {
    const seen = new Set<string>()
    const unique: typeof predictions = []

    predictions.forEach(pred => {
      const key = `${pred.redBalls.sort().join('-')}-${pred.blueBall}`
      if (!seen.has(key)) {
        seen.add(key)
        
        // 重新计算得分（结合统计分析）
        const hotScore = pred.redBalls.filter(b => 
          statistical.frequency.hotNumbers.includes(b)
        ).length / 6

        const omissionScore = pred.redBalls.filter(b =>
          statistical.omission.highOmission.includes(b)
        ).length / 6

        // 综合得分
        pred.score = pred.score * 0.6 + (hotScore * 0.2 + omissionScore * 0.2) * 0.4
        pred.confidence = Math.min(1, pred.confidence + (hotScore + omissionScore) * 0.1)

        unique.push(pred)
      }
    })

    return unique
  }

  /**
   * 生成基于统计分析的预测
   * 业务逻辑：基于频率、遗漏、分布分析生成预测
   * 技术实现：选择热号、温号、冷号的组合，确保分布合理
   */
  private generateStatisticalPredictions(
    analysis: ComprehensiveAnalysis
  ): Array<{
    redBalls: string[]
    blueBall: string
    confidence: number
    strategy: string
    reasoning: string
  }> {
    const predictions: Array<{
      redBalls: string[]
      blueBall: string
      confidence: number
      strategy: string
      reasoning: string
    }> = []

    // 策略1：保守型（主要热号）
    const conservative = this.selectBalls(analysis, {
      hot: 4,
      warm: 1,
      cold: 1,
      highOmission: 0
    })
    predictions.push({
      redBalls: conservative,
      blueBall: analysis.frequency.blueBalls[0]?.number || '01',
      confidence: 0.7,
      strategy: '保守型',
      reasoning: '基于热号频率分析，选择出现频率最高的号码，提高小奖概率'
    })

    // 策略2：平衡型
    const balanced = this.selectBalls(analysis, {
      hot: 2,
      warm: 2,
      cold: 1,
      highOmission: 1
    })
    predictions.push({
      redBalls: balanced,
      blueBall: analysis.frequency.blueBalls[1]?.number || '02',
      confidence: 0.65,
      strategy: '平衡型',
      reasoning: '平衡热号、温号、冷号和高遗漏号码，兼顾大小奖概率'
    })

    // 策略3：激进型（主要冷号和高遗漏）
    const aggressive = this.selectBalls(analysis, {
      hot: 1,
      warm: 1,
      cold: 2,
      highOmission: 2
    })
    predictions.push({
      redBalls: aggressive,
      blueBall: analysis.frequency.blueBalls[analysis.frequency.blueBalls.length - 1]?.number || '16',
      confidence: 0.55,
      strategy: '激进型',
      reasoning: '选择冷号和高遗漏号码，追求大奖，但中奖概率较低'
    })

    return predictions
  }

  /**
   * 选择号码组合
   * 业务逻辑：根据策略选择不同类别的号码组合
   * 技术实现：从热号、温号、冷号、高遗漏中按比例选择
   */
  private selectBalls(
    analysis: ComprehensiveAnalysis,
    counts: { hot: number; warm: number; cold: number; highOmission: number }
  ): string[] {
    const result: string[] = []
    const used = new Set<string>()

    // 选择热号
    for (let i = 0; i < counts.hot && i < analysis.frequency.hotNumbers.length; i++) {
      const num = analysis.frequency.hotNumbers[i]
      if (!used.has(num)) {
        result.push(num)
        used.add(num)
      }
    }

    // 选择温号
    for (let i = 0; i < counts.warm && i < analysis.frequency.warmNumbers.length; i++) {
      const num = analysis.frequency.warmNumbers[i]
      if (!used.has(num)) {
        result.push(num)
        used.add(num)
      }
    }

    // 选择冷号
    for (let i = 0; i < counts.cold && i < analysis.frequency.coldNumbers.length; i++) {
      const num = analysis.frequency.coldNumbers[i]
      if (!used.has(num)) {
        result.push(num)
        used.add(num)
      }
    }

    // 选择高遗漏
    for (let i = 0; i < counts.highOmission && i < analysis.omission.highOmission.length; i++) {
      const num = analysis.omission.highOmission[i]
      if (!used.has(num)) {
        result.push(num)
        used.add(num)
      }
    }

    // 如果不够6个，随机补充
    while (result.length < 6) {
      const num = Math.floor(Math.random() * 33) + 1
      const numStr = num.toString().padStart(2, '0')
      if (!used.has(numStr)) {
        result.push(numStr)
        used.add(numStr)
      }
    }

    return result.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b))
  }

  /**
   * 确定策略类型
   */
  private determineStrategy(pred: MLPredictionResult['predictions'][0]): string {
    if (pred.features.hotScore > 0.6) return '保守型'
    if (pred.features.omissionScore > 0.5) return '激进型'
    return '平衡型'
  }

  /**
   * 生成补充预测（当不足5组时）
   */
  private generateSupplementaryPrediction(
    analysis: ComprehensiveAnalysis,
    existing: PredictionResult[]
  ): PredictionResult {
    const used = new Set<string>()
    existing.forEach(p => {
      p.redBalls.forEach(b => used.add(b))
    })

    // 选择未使用的热号
    const available = analysis.frequency.hotNumbers.filter(b => !used.has(b))
    const redBalls = available.slice(0, 6)
    
    // 如果不够，补充
    while (redBalls.length < 6) {
      const num = Math.floor(Math.random() * 33) + 1
      const numStr = num.toString().padStart(2, '0')
      if (!used.has(numStr) && !redBalls.includes(numStr)) {
        redBalls.push(numStr)
      }
    }

    return {
      redBalls: redBalls.sort((a, b) => parseInt(a) - parseInt(b)),
      blueBall: analysis.frequency.blueBalls[existing.length % analysis.frequency.blueBalls.length]?.number || '01',
      confidence: 0.6,
      strategy: '平衡型',
      reasoning: '补充预测：基于频率分析生成',
      sources: ['statistical']
    }
  }
}

