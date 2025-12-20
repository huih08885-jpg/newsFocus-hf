import { NextRequest, NextResponse } from 'next/server'
import { LotteryAnalysisService } from '@/lib/services/lottery-analysis'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculateNextPeriod } from '@/lib/utils/lottery-period'
import { generateStatisticalRecommendations } from '@/lib/utils/lottery-recommendations'

/**
 * 统计分析预测
 * POST /api/lottery/predict/statistical
 * 
 * 业务逻辑：仅使用统计分析生成预测，不依赖AI和机器学习
 * 技术实现：调用LotteryAnalysisService进行综合分析，基于频率、遗漏、分布等生成预测
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      periods = 100, 
      numPredictions = 5,
      deterministic = false,
      strategyWeights = {
        conservative: 0.4,
        balanced: 0.4,
        aggressive: 0.2
      }
    } = body

    logger.info('收到统计分析预测请求', 'StatisticalPredictAPI', { 
      periods, 
      numPredictions,
      deterministic,
      strategyWeights
    })

    // 获取当前用户
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '需要登录'
        },
        { status: 401 }
      )
    }

    // 验证参数
    if (periods < 10) {
      return NextResponse.json(
        {
          success: false,
          error: '历史数据期数不能少于10期'
        },
        { status: 400 }
      )
    }

    if (numPredictions < 1 || numPredictions > 10) {
      return NextResponse.json(
        {
          success: false,
          error: '预测组数必须在1-10之间'
        },
        { status: 400 }
      )
    }

    // 执行统计分析
    const analysisService = new LotteryAnalysisService()
    // 计算下一期期号
    const nextPeriod = await calculateNextPeriod()

    const analysis = await analysisService.comprehensiveAnalysis(periods)

    // 基于统计分析生成预测
    const predictions = generateStatisticalPredictions(
      analysis, 
      numPredictions,
      deterministic,
      strategyWeights
    )

    logger.info('统计分析预测完成', 'StatisticalPredictAPI', {
      predictionCount: predictions.length,
      nextPeriod
    })

    // 生成分析建议
    const recommendations = generateStatisticalRecommendations(analysis)

    // 保存分析结果
    const savedAnalysis = await prisma.lotteryAnalysis.create({
      data: {
        userId: user.id,
        type: 'statistical',
        periods,
        config: { 
          periods, 
          numPredictions,
          deterministic,
          strategyWeights,
          nextPeriod
        } as any,
        result: {
          frequency: analysis.frequency,
          omission: analysis.omission,
          distribution: analysis.distribution,
          patterns: analysis.patterns,
          recommendations
        } as any,
        summary: `统计分析预测：使用${periods}期数据，生成${predictions.length}组预测，预测期号：${nextPeriod}`
      }
    })

    // 保存预测结果
    const savedPredictions = await Promise.all(
      predictions.map(pred =>
        prisma.lotteryPrediction.create({
          data: {
            userId: user.id,
            period: nextPeriod,
            redBalls: pred.redBalls,
            blueBall: pred.blueBall,
            confidence: pred.confidence,
            strategy: pred.strategy,
            reasoning: pred.reasoning,
            sources: ['statistical'],
            analysisId: savedAnalysis.id
          }
        })
      )
    )

    logger.info('统计分析预测结果已保存到数据库', 'StatisticalPredictAPI', {
      analysisId: savedAnalysis.id,
      predictionCount: savedPredictions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        predictions,
        analysis: {
          frequency: analysis.frequency,
          omission: analysis.omission,
          distribution: analysis.distribution,
          patterns: analysis.patterns
        },
        metadata: {
          totalPeriods: periods,
          predictionDate: new Date(),
          method: 'statistical'
        },
        analysisId: savedAnalysis.id,
        predictionIds: savedPredictions.map(p => p.id)
      }
    })

  } catch (error) {
    return handleError(error, 'StatisticalPredictAPI', {
      endpoint: '/api/lottery/predict/statistical'
    })
  }
}

/**
 * 生成基于统计分析的预测
 * 业务逻辑：基于频率、遗漏、分布分析生成预测
 * 技术实现：选择热号、温号、冷号的组合，确保分布合理
 */
function generateStatisticalPredictions(
  analysis: any,
  numPredictions: number,
  deterministic: boolean = false,
  strategyWeights: { conservative: number; balanced: number; aggressive: number } = {
    conservative: 0.4,
    balanced: 0.4,
    aggressive: 0.2
  }
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

  const strategies = [
    { name: '保守型', hot: 4, warm: 1, cold: 1, highOmission: 0, confidence: 0.7 },
    { name: '平衡型', hot: 2, warm: 2, cold: 1, highOmission: 1, confidence: 0.65 },
    { name: '激进型', hot: 1, warm: 1, cold: 2, highOmission: 2, confidence: 0.55 },
    { name: '平衡型', hot: 3, warm: 2, cold: 0, highOmission: 1, confidence: 0.68 },
    { name: '保守型', hot: 5, warm: 0, cold: 1, highOmission: 0, confidence: 0.72 }
  ]

  for (let i = 0; i < numPredictions && i < strategies.length; i++) {
    const strategy = strategies[i]
    const redBalls = selectBalls(analysis, strategy, deterministic)
    const blueBall = analysis.frequency.blueBalls[i % analysis.frequency.blueBalls.length]?.number || '01'

    let reasoning = ''
    if (strategy.name === '保守型') {
      reasoning = '基于热号频率分析，选择出现频率最高的号码，提高小奖概率'
    } else if (strategy.name === '平衡型') {
      reasoning = '平衡热号、温号、冷号和高遗漏号码，兼顾大小奖概率'
    } else {
      reasoning = '选择冷号和高遗漏号码，追求大奖，但中奖概率较低'
    }

    predictions.push({
      redBalls,
      blueBall,
      confidence: strategy.confidence,
      strategy: strategy.name,
      reasoning
    })
  }

    // 如果需要的预测数超过策略数，补充生成
    while (predictions.length < numPredictions) {
      const strategy = strategies[predictions.length % strategies.length]
      const redBalls = selectBalls(analysis, strategy, deterministic)
      const blueBall = analysis.frequency.blueBalls[predictions.length % analysis.frequency.blueBalls.length]?.number || '01'

    predictions.push({
      redBalls,
      blueBall,
      confidence: 0.6,
      strategy: '平衡型',
      reasoning: '基于统计分析生成的补充预测'
    })
  }

  return predictions.slice(0, numPredictions)
}

/**
 * 选择号码组合
 */
function selectBalls(
  analysis: any,
  counts: { hot: number; warm: number; cold: number; highOmission: number },
  deterministic: boolean = false
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

  // 如果不够6个，补充号码
  if (result.length < 6) {
    // 确定性模式：按顺序选择未使用的号码
    // 随机模式：随机选择未使用的号码
    const availableNumbers: string[] = []
    for (let i = 1; i <= 33; i++) {
      const numStr = i.toString().padStart(2, '0')
      if (!used.has(numStr)) {
        availableNumbers.push(numStr)
      }
    }
    
    // 如果确定性模式，按顺序选择；否则随机选择
    if (deterministic) {
      // 按号码顺序选择
      result.push(...availableNumbers.slice(0, 6 - result.length))
    } else {
      // 随机选择
      while (result.length < 6 && availableNumbers.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableNumbers.length)
        result.push(availableNumbers.splice(randomIndex, 1)[0])
      }
    }
  }

  return result.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b))
}

