/**
 * 彩票预测评估API
 * POST /api/lottery/evaluate
 * 
 * 业务逻辑：评估预测结果的中奖情况，记录到数据库用于优化
 * 技术实现：对比预测结果和实际开奖结果，计算各项指标
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { LotteryPredictionEvaluator } from '@/lib/services/lottery-prediction-evaluator'
import { LotteryWinningTracker } from '@/lib/services/lottery-winning-tracker'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { predictionId, period } = body

    if (!predictionId && !period) {
      return NextResponse.json(
        {
          success: false,
          error: '需要提供 predictionId 或 period'
        },
        { status: 400 }
      )
    }

    // 获取预测结果
    let prediction
    if (predictionId) {
      prediction = await prisma.lotteryPrediction.findUnique({
        where: { id: predictionId },
        include: {
          user: true
        }
      })
    } else if (period) {
      // 根据期号查找预测
      prediction = await prisma.lotteryPrediction.findFirst({
        where: {
          period,
          userId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: true
        }
      })
    }

    if (!prediction) {
      return NextResponse.json(
        {
          success: false,
          error: '预测记录不存在'
        },
        { status: 404 }
      )
    }

    // 获取实际开奖结果
    const actualResult = await prisma.lotteryResult.findUnique({
      where: { period: prediction.period || undefined }
    })

    if (!actualResult) {
      return NextResponse.json(
        {
          success: false,
          error: '开奖结果不存在，请先爬取开奖结果'
        },
        { status: 404 }
      )
    }

    // 评估预测结果
    const evaluator = new LotteryPredictionEvaluator()
    const evaluation = evaluator.evaluate(
      {
        redBalls: prediction.redBalls,
        blueBall: prediction.blueBall,
        confidence: prediction.confidence,
        strategy: prediction.strategy,
        reasoning: prediction.reasoning || '',
        sources: prediction.sources
      },
      {
        period: actualResult.period,
        date: actualResult.date.toISOString().split('T')[0], // 转换为字符串格式 YYYY-MM-DD
        redBalls: actualResult.redBalls,
        blueBall: actualResult.blueBall,
        metadata: actualResult.metadata as any
      }
    )

    // 分析失败原因（如果未中奖或中奖等级较低）
    const failureAnalysis = evaluation.prizeLevel === '0' || parseInt(evaluation.prizeLevel) > 3
      ? evaluator.analyzeFailure(
          {
            redBalls: prediction.redBalls,
            blueBall: prediction.blueBall,
            confidence: prediction.confidence,
            strategy: prediction.strategy,
            reasoning: prediction.reasoning || '',
            sources: prediction.sources
          },
          {
            period: actualResult.period,
            date: actualResult.date.toISOString().split('T')[0], // 转换为字符串格式 YYYY-MM-DD
            redBalls: actualResult.redBalls,
            blueBall: actualResult.blueBall,
            metadata: actualResult.metadata as any
          },
          evaluation
        )
      : null

    // 记录到数据库
    const winningTracker = new LotteryWinningTracker()
    await winningTracker.trackWinning(
      prediction.id,
      actualResult.id,
      actualResult.redBalls,
      actualResult.blueBall,
      prediction.strategy,
      prediction.sources[0] as 'statistical' | 'ai' | 'ml' | 'comprehensive' || 'comprehensive'
    )

    logger.info('预测评估完成', 'LotteryEvaluateAPI', {
      predictionId: prediction.id,
      period: prediction.period,
      prizeLevel: evaluation.prizeLevel,
      accuracy: evaluation.accuracy,
      score: evaluation.score
    })

    return NextResponse.json({
      success: true,
      data: {
        evaluation,
        failureAnalysis,
        prediction: {
          id: prediction.id,
          period: prediction.period,
          redBalls: prediction.redBalls,
          blueBall: prediction.blueBall
        },
        actualResult: {
          period: actualResult.period,
          redBalls: actualResult.redBalls,
          blueBall: actualResult.blueBall
        }
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryEvaluateAPI', '评估预测结果失败')
  }
}

/**
 * 获取评估统计
 * GET /api/lottery/evaluate
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const periods = parseInt(searchParams.get('periods') || '50')

    const winningTracker = new LotteryWinningTracker()
    // 只统计当前用户的评估数据
    const winningRates = await winningTracker.getWinningRates(periods, user.id)
    const optimalWeights = await winningTracker.getOptimalWeights(periods, user.id)

    return NextResponse.json({
      success: true,
      data: {
        winningRates,
        optimalWeights,
        periods
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryEvaluateAPI', '获取评估统计失败')
  }
}

