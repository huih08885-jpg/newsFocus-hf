import { NextRequest, NextResponse } from 'next/server'
import { LotteryPredictor } from '@/lib/services/lottery-predictor'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculateNextPeriod } from '@/lib/utils/lottery-period'
import { generateStatisticalRecommendations, generateMLRecommendations } from '@/lib/utils/lottery-recommendations'

/**
 * 生成福利彩票预测
 * POST /api/lottery/predict
 * 
 * 业务逻辑：接收预测请求，调用综合预测服务生成5组预测号码
 * 技术实现：使用Next.js API Route处理POST请求，调用LotteryPredictor服务
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({}))
    const { periods = 100 } = body

    logger.info('收到预测请求', 'LotteryPredictAPI', { 
      userId: user.id,
      periods 
    })

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

    // 计算下一期期号
    const nextPeriod = await calculateNextPeriod()

    // 创建预测服务并生成预测
    const predictor = new LotteryPredictor()
    const result = await predictor.predict(periods)

    logger.info('预测生成完成', 'LotteryPredictAPI', {
      predictionCount: result.predictions.length,
      hasAI: !!result.analysis.ai,
      hasML: !!result.analysis.ml,
      nextPeriod
    })

    // 生成分析建议
    const statisticalRecommendations = generateStatisticalRecommendations(result.analysis.statistical)
    const mlRecommendations = result.analysis.ml 
      ? generateMLRecommendations(result.analysis.statistical, result.analysis.ml.featureImportance)
      : null

    // 保存分析结果
    const savedAnalysis = await prisma.lotteryAnalysis.create({
      data: {
        userId: user.id,
        type: 'comprehensive',
        periods,
        config: { periods, nextPeriod } as any,
        result: {
          statistical: {
            ...result.analysis.statistical,
            recommendations: statisticalRecommendations
          },
          ai: result.analysis.ai,
          ml: result.analysis.ml ? {
            ...result.analysis.ml,
            recommendations: mlRecommendations
          } : null
        } as any,
        summary: `综合分析：使用${periods}期数据，生成${result.predictions.length}组预测，预测期号：${nextPeriod}`
      }
    })

    // 保存预测结果（所有预测组使用相同的期号）
    const savedPredictions = await Promise.all(
      result.predictions.map(pred =>
        prisma.lotteryPrediction.create({
          data: {
            userId: user.id,
            period: nextPeriod,
            redBalls: pred.redBalls,
            blueBall: pred.blueBall,
            confidence: pred.confidence,
            strategy: pred.strategy,
            reasoning: pred.reasoning,
            sources: pred.sources,
            analysisId: savedAnalysis.id
          }
        })
      )
    )

    logger.info('预测结果已保存到数据库', 'LotteryPredictAPI', {
      analysisId: savedAnalysis.id,
      predictionCount: savedPredictions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        analysisId: savedAnalysis.id,
        predictionIds: savedPredictions.map(p => p.id)
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryPredictAPI', '生成综合预测失败')
  }
}

/**
 * 获取预测历史（可选功能）
 * GET /api/lottery/predict
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // TODO: 可以保存预测历史到数据库
    return NextResponse.json({
      success: true,
      data: {
        message: '预测历史功能待实现'
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryPredictAPI', '获取预测历史失败')
  }
}

