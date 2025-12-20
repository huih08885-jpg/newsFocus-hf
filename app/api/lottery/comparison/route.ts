import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'

/**
 * 对比预测结果和实际开奖结果
 * POST /api/lottery/comparison
 * 
 * 业务逻辑：将预测结果与实际开奖结果对比，计算命中数、中奖等级、准确度等
 * 技术实现：匹配红球和蓝球，计算命中数，根据双色球规则确定中奖等级
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { predictionId, resultId, period } = body

    if (!predictionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'predictionId 是必需的'
        },
        { status: 400 }
      )
    }

    // 获取预测结果
    const prediction = await prisma.lotteryPrediction.findUnique({
      where: { id: predictionId }
    })

    if (!prediction) {
      return NextResponse.json(
        {
          success: false,
          error: '预测结果不存在'
        },
        { status: 404 }
      )
    }

    // 获取实际开奖结果
    let result: any = null
    if (resultId) {
      result = await prisma.lotteryResult.findUnique({
        where: { id: resultId }
      })
    } else if (period) {
      result = await prisma.lotteryResult.findUnique({
        where: { period }
      })
    }

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: '开奖结果不存在，请提供 resultId 或 period'
        },
        { status: 404 }
      )
    }

    // 计算红球命中数
    const predictedRedSet = new Set(prediction.redBalls)
    const actualRedSet = new Set(result.redBalls)
    const redBallsHit = prediction.redBalls.filter(b => actualRedSet.has(b)).length

    // 计算蓝球是否命中
    const blueBallHit = prediction.blueBall === result.blueBall

    // 确定中奖等级（双色球规则）
    let prizeLevel: string | null = null
    let prizeAmount: number = 0

    if (redBallsHit === 6 && blueBallHit) {
      prizeLevel = '一等奖'
      prizeAmount = 5000000 // 示例金额，实际需要查询
    } else if (redBallsHit === 6) {
      prizeLevel = '二等奖'
      prizeAmount = 200000 // 示例金额
    } else if (redBallsHit === 5 && blueBallHit) {
      prizeLevel = '三等奖'
      prizeAmount = 3000
    } else if (redBallsHit === 5 || (redBallsHit === 4 && blueBallHit)) {
      prizeLevel = '四等奖'
      prizeAmount = 200
    } else if (redBallsHit === 4 || (redBallsHit === 3 && blueBallHit)) {
      prizeLevel = '五等奖'
      prizeAmount = 10
    } else if (blueBallHit) {
      prizeLevel = '六等奖'
      prizeAmount = 5
    }

    // 计算准确度（0-1）
    // 红球准确度：命中数/6
    // 蓝球准确度：命中为1，未命中为0
    // 综合准确度：红球权重0.8，蓝球权重0.2
    const redAccuracy = redBallsHit / 6
    const blueAccuracy = blueBallHit ? 1 : 0
    const accuracy = redAccuracy * 0.8 + blueAccuracy * 0.2

    // 保存对比结果
    const comparison = await prisma.lotteryComparison.create({
      data: {
        predictionId: prediction.id,
        resultId: result.id,
        period: result.period,
        redBallsHit,
        blueBallHit,
        prizeLevel,
        prizeAmount,
        accuracy
      }
    })

    logger.info('对比结果已保存', 'LotteryComparisonAPI', {
      comparisonId: comparison.id,
      redBallsHit,
      blueBallHit,
      prizeLevel
    })

    return NextResponse.json({
      success: true,
      data: {
        id: comparison.id,
        prediction: {
          redBalls: prediction.redBalls,
          blueBall: prediction.blueBall
        },
        result: {
          period: result.period,
          redBalls: result.redBalls,
          blueBall: result.blueBall
        },
        comparison: {
          redBallsHit,
          blueBallHit,
          prizeLevel,
          prizeAmount,
          accuracy
        }
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryComparisonAPI', '创建预测对比失败')
  }
}

/**
 * 获取对比历史
 * GET /api/lottery/comparison
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const period = searchParams.get('period')
    const prizeLevel = searchParams.get('prizeLevel')

    const where: any = {}
    if (period) {
      where.period = period
    }
    if (prizeLevel) {
      where.prizeLevel = prizeLevel
    }

    const [comparisons, total] = await Promise.all([
      prisma.lotteryComparison.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          prediction: {
            select: {
              id: true,
              redBalls: true,
              blueBall: true,
              strategy: true,
              confidence: true
            }
          },
          result: {
            select: {
              id: true,
              period: true,
              date: true,
              redBalls: true,
              blueBall: true
            }
          }
        }
      }),
      prisma.lotteryComparison.count({ where })
    ])

    // 计算统计信息
    const stats = {
      total: total,
      totalPrize: comparisons.reduce((sum, c) => sum + (c.prizeAmount || 0), 0),
      averageAccuracy: comparisons.length > 0
        ? comparisons.reduce((sum, c) => sum + c.accuracy, 0) / comparisons.length
        : 0,
      prizeDistribution: {
        一等奖: comparisons.filter(c => c.prizeLevel === '一等奖').length,
        二等奖: comparisons.filter(c => c.prizeLevel === '二等奖').length,
        三等奖: comparisons.filter(c => c.prizeLevel === '三等奖').length,
        四等奖: comparisons.filter(c => c.prizeLevel === '四等奖').length,
        五等奖: comparisons.filter(c => c.prizeLevel === '五等奖').length,
        六等奖: comparisons.filter(c => c.prizeLevel === '六等奖').length
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        stats,
        total,
        limit,
        offset
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryComparisonAPI', '获取对比历史失败')
  }
}

