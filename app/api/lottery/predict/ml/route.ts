import { NextRequest, NextResponse } from 'next/server'
import { LotteryAnalysisService } from '@/lib/services/lottery-analysis'
import { LotteryMLPredictor } from '@/lib/services/lottery-ml-predictor'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculateNextPeriod } from '@/lib/utils/lottery-period'
import { generateMLRecommendations } from '@/lib/utils/lottery-recommendations'

/**
 * 机器学习预测
 * POST /api/lottery/predict/ml
 * 
 * 业务逻辑：仅使用机器学习模型生成预测，不依赖统计分析和AI分析
 * 技术实现：提取特征（频率、遗漏、分布等），使用概率模型进行预测
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      periods = 100,
      featureWeights = {
        frequency: 0.3,
        omission: 0.2,
        hot: 0.2,
        cold: 0.15,
        highOmission: 0.15
      }
    } = body

    logger.info('收到机器学习预测请求', 'MLPredictAPI', { 
      periods,
      featureWeights
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

    // 执行统计分析（作为机器学习的输入）
    const analysisService = new LotteryAnalysisService()
    const statisticalAnalysis = await analysisService.comprehensiveAnalysis(periods)

    // 计算下一期期号
    const nextPeriod = await calculateNextPeriod()

    // 执行机器学习预测
    const mlPredictor = new LotteryMLPredictor()
    const mlResult = await mlPredictor.predict(statisticalAnalysis, featureWeights)

    logger.info('机器学习预测完成', 'MLPredictAPI', {
      predictionCount: mlResult.predictions.length,
      nextPeriod
    })

    // 生成分析建议
    const recommendations = generateMLRecommendations(statisticalAnalysis, mlResult.featureImportance)

    // 保存分析结果
    const savedAnalysis = await prisma.lotteryAnalysis.create({
      data: {
        userId: user.id,
        type: 'ml',
        periods,
        config: { 
          periods,
          featureWeights,
          nextPeriod
        } as any,
        result: {
          predictions: mlResult.predictions,
          featureImportance: mlResult.featureImportance,
          recommendations
        } as any,
        summary: `机器学习预测：使用${periods}期数据，生成${mlResult.predictions.length}组预测，预测期号：${nextPeriod}`
      }
    })

    // 保存预测结果
    const savedPredictions = await Promise.all(
      mlResult.predictions.map(pred =>
        prisma.lotteryPrediction.create({
          data: {
            userId: user.id,
            period: nextPeriod,
            redBalls: pred.redBalls,
            blueBall: pred.blueBall,
            confidence: pred.confidence,
            strategy: determineStrategy(pred),
            reasoning: `机器学习预测：热号得分${pred.features.hotScore.toFixed(2)}，遗漏得分${pred.features.omissionScore.toFixed(2)}，分布得分${pred.features.distributionScore.toFixed(2)}`,
            sources: ['ml'],
            analysisId: savedAnalysis.id
          }
        })
      )
    )

    logger.info('机器学习预测结果已保存到数据库', 'MLPredictAPI', {
      analysisId: savedAnalysis.id,
      predictionCount: savedPredictions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        predictions: mlResult.predictions.map(p => ({
          redBalls: p.redBalls,
          blueBall: p.blueBall,
          confidence: p.confidence,
          strategy: determineStrategy(p),
          reasoning: `机器学习预测：热号得分${p.features.hotScore.toFixed(2)}，遗漏得分${p.features.omissionScore.toFixed(2)}，分布得分${p.features.distributionScore.toFixed(2)}`,
          sources: ['ml']
        })),
        analysis: {
          ml: mlResult
        },
        metadata: {
          totalPeriods: periods,
          predictionDate: new Date(),
          method: 'ml'
        },
        analysisId: savedAnalysis.id,
        predictionIds: savedPredictions.map(p => p.id)
      }
    })

  } catch (error) {
    return handleError(error, 'MLPredictAPI', {
      endpoint: '/api/lottery/predict/ml'
    })
  }
}

/**
 * 确定策略类型
 */
function determineStrategy(pred: any): string {
  if (pred.features.hotScore > 0.6) return '保守型'
  if (pred.features.omissionScore > 0.5) return '激进型'
  return '平衡型'
}

