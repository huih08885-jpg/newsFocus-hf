import { NextRequest, NextResponse } from 'next/server'
import { LotteryAnalysisService } from '@/lib/services/lottery-analysis'
import { LotteryAIPredictor } from '@/lib/services/lottery-ai-predictor'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculateNextPeriod } from '@/lib/utils/lottery-period'

/**
 * AI分析预测
 * POST /api/lottery/predict/ai
 * 
 * 业务逻辑：仅使用AI分析（DeepSeek）生成预测，不依赖统计分析和机器学习
 * 技术实现：调用DeepSeek API，传入历史数据和统计分析结果，让AI进行深度分析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      periods = 100,
      temperature = 0.7,
      maxTokens = 2000,
      useFallback = true
    } = body

    logger.info('收到AI分析预测请求', 'AIPredictAPI', { 
      periods,
      temperature,
      maxTokens,
      useFallback
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

    // 获取历史数据
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
      return NextResponse.json(
        {
          success: false,
          error: `历史数据不足，至少需要10期数据，当前只有 ${historyData.length} 期`
        },
        { status: 400 }
      )
    }

    const reversedHistory = historyData.reverse() // 按时间正序

    // 执行统计分析（作为AI分析的输入）
    const analysisService = new LotteryAnalysisService()
    const statisticalAnalysis = await analysisService.comprehensiveAnalysis(periods)

    // 执行AI分析
    const aiPredictor = new LotteryAIPredictor()
    let aiResult
    try {
      aiResult = await aiPredictor.analyzeWithLLM(
        reversedHistory, 
        statisticalAnalysis,
        {
          temperature,
          maxTokens
        }
      )
    } catch (error) {
      // 如果启用备用方案且AI调用失败，使用统计分析生成预测
      if (useFallback) {
        logger.warn('AI预测失败，使用备用方案', 'AIPredictAPI', { error: error instanceof Error ? error.message : String(error) })
        aiResult = aiPredictor.generateFallbackPrediction(statisticalAnalysis)
      } else {
        throw error
      }
    }

    // 计算下一期期号
    const nextPeriod = await calculateNextPeriod()

    logger.info('AI分析预测完成', 'AIPredictAPI', {
      predictionCount: aiResult.predictions.length,
      nextPeriod
    })

    // 保存分析结果
    const savedAnalysis = await prisma.lotteryAnalysis.create({
      data: {
        userId: user.id,
        type: 'ai',
        periods,
        config: { 
          periods,
          temperature,
          maxTokens,
          useFallback,
          nextPeriod
        } as any,
        result: {
          predictions: aiResult.predictions,
          analysis: aiResult.analysis,
          recommendations: aiResult.recommendations
        } as any,
        summary: `AI分析预测：使用${periods}期数据，生成${aiResult.predictions.length}组预测，预测期号：${nextPeriod}`
      }
    })

    // 保存预测结果
    const savedPredictions = await Promise.all(
      aiResult.predictions.map(pred =>
        prisma.lotteryPrediction.create({
          data: {
            userId: user.id,
            period: nextPeriod,
            redBalls: pred.redBalls,
            blueBall: pred.blueBall,
            confidence: pred.confidence,
            strategy: pred.strategy,
            reasoning: pred.reasoning,
            sources: ['ai'],
            analysisId: savedAnalysis.id
          }
        })
      )
    )

    logger.info('AI分析预测结果已保存到数据库', 'AIPredictAPI', {
      analysisId: savedAnalysis.id,
      predictionCount: savedPredictions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        predictions: aiResult.predictions.map(p => ({
          redBalls: p.redBalls,
          blueBall: p.blueBall,
          confidence: p.confidence,
          strategy: p.strategy,
          reasoning: p.reasoning,
          sources: ['ai']
        })),
        analysis: {
          ai: aiResult
        },
        metadata: {
          totalPeriods: periods,
          predictionDate: new Date(),
          method: 'ai'
        },
        analysisId: savedAnalysis.id,
        predictionIds: savedPredictions.map(p => p.id)
      }
    })

  } catch (error) {
    return handleError(error, 'AIPredictAPI', 'AI分析预测失败')
  }
}

