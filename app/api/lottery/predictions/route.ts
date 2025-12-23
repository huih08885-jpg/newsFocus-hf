import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { getCurrentUser } from '@/lib/auth'
import { calculatePrizeLevel } from '@/lib/utils/lottery-period'

export const dynamic = 'force-dynamic'

/**
 * 获取预测历史
 * GET /api/lottery/predictions
 * 
 * 业务逻辑：查询所有保存的预测记录，支持按方法、日期、期号等筛选
 * 技术实现：使用Prisma查询lottery_predictions表，支持分页和排序
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '需要登录' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const method = searchParams.get('method') // statistical, ai, ml, comprehensive
    const period = searchParams.get('period')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 查询条件：优先查询当前用户的记录，如果没有则查询所有记录（用于测试/调试）
    const where: any = {
      userId: user.id // 只查询当前用户的预测记录
    }
    
    // 先检查当前用户是否有记录
    const userRecordCount = await prisma.lotteryPrediction.count({
      where: { userId: user.id }
    })
    
    // 如果当前用户没有记录，但数据库中有记录，则查询所有记录（可能是测试数据）
    if (userRecordCount === 0) {
      const totalRecordCount = await prisma.lotteryPrediction.count()
      if (totalRecordCount > 0) {
        logger.warn('当前用户没有预测记录，但数据库中有其他记录', 'PredictionsAPI', {
          userId: user.id,
          totalRecords: totalRecordCount
        })
        // 暂时允许查看所有记录（用于测试/调试）
        delete where.userId
      }
    }

    // 按方法筛选
    if (method) {
      where.analysis = {
        type: method === 'comprehensive' ? 'comprehensive' : method
      }
    }

    // 按期号筛选
    if (period) {
      where.period = period
    }

    // 按日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    const [predictions, total] = await Promise.all([
      prisma.lotteryPrediction.findMany({
        where,
        include: {
          analysis: {
            select: {
              id: true,
              type: true,
              periods: true,
              config: true,
              result: true,
              summary: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder as 'asc' | 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.lotteryPrediction.count({ where })
    ])

    // 获取所有预测的期号，查询对应的开奖结果
    const periods = [...new Set(predictions.map(p => p.period).filter(Boolean) as string[])]
    const lotteryResults = periods.length > 0
      ? await prisma.lotteryResult.findMany({
          where: { period: { in: periods } },
          select: {
            period: true,
            redBalls: true,
            blueBall: true
          }
        })
      : []

    const resultsMap = new Map(lotteryResults.map(r => [r.period, r]))

    // 为每个预测添加开奖结果和中奖信息
    const predictionsWithResults = predictions.map(pred => {
      const result = pred.period ? resultsMap.get(pred.period) : null
      let prizeInfo = null

      if (result) {
        const prize = calculatePrizeLevel(
          pred.redBalls,
          pred.blueBall,
          result.redBalls,
          result.blueBall
        )
        prizeInfo = {
          ...prize,
          actualRedBalls: result.redBalls,
          actualBlueBall: result.blueBall
        }
      }

      return {
        ...pred,
        result,
        prizeInfo
      }
    })

    // 统计信息（只统计当前用户的数据）
    const userWhere = { userId: user.id }
    
    // 获取所有预测记录用于计算中奖统计
    const allUserPredictions = await prisma.lotteryPrediction.findMany({
      where: userWhere,
      select: {
        id: true,
        period: true,
        redBalls: true,
        blueBall: true,
        analysis: {
          select: {
            type: true
          }
        }
      }
    })

    // 获取所有预测的期号对应的开奖结果
    const allPeriods = [...new Set(allUserPredictions.map(p => p.period).filter(Boolean) as string[])]
    const allLotteryResults = allPeriods.length > 0
      ? await prisma.lotteryResult.findMany({
          where: { period: { in: allPeriods } },
          select: {
            period: true,
            redBalls: true,
            blueBall: true
          }
        })
      : []
    const allResultsMap = new Map(allLotteryResults.map(r => [r.period, r]))

    // 计算每个方法的中奖数
    const calculateWinningCount = (type: string) => {
      const methodPredictions = allUserPredictions.filter(p => p.analysis?.type === type)
      let winningCount = 0
      
      methodPredictions.forEach(pred => {
        if (pred.period) {
          const result = allResultsMap.get(pred.period)
          if (result) {
            const prize = calculatePrizeLevel(
              pred.redBalls,
              pred.blueBall,
              result.redBalls,
              result.blueBall
            )
            // 中奖：prizeLevel 不为 '0'
            if (prize.prizeLevel !== '0') {
              winningCount++
            }
          }
        }
      })
      
      return winningCount
    }

    const statisticalCount = await prisma.lotteryPrediction.count({
      where: { ...userWhere, analysis: { type: 'statistical' } }
    })
    const aiCount = await prisma.lotteryPrediction.count({
      where: { ...userWhere, analysis: { type: 'ai' } }
    })
    const mlCount = await prisma.lotteryPrediction.count({
      where: { ...userWhere, analysis: { type: 'ml' } }
    })
    const comprehensiveCount = await prisma.lotteryPrediction.count({
      where: { ...userWhere, analysis: { type: 'comprehensive' } }
    })

    const stats = {
      total,
      byMethod: {
        statistical: {
          total: statisticalCount,
          winning: calculateWinningCount('statistical')
        },
        ai: {
          total: aiCount,
          winning: calculateWinningCount('ai')
        },
        ml: {
          total: mlCount,
          winning: calculateWinningCount('ml')
        },
        comprehensive: {
          total: comprehensiveCount,
          winning: calculateWinningCount('comprehensive')
        }
      },
      averageConfidence: predictions.length > 0
        ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
        : 0
    }

    logger.info('获取预测历史', 'PredictionsAPI', {
      total,
      limit,
      offset,
      method,
      period,
      userId: user.id,
      foundPredictions: predictions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        predictions: predictionsWithResults,
        stats,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    return handleError(error, 'PredictionsAPI', '获取预测历史失败')
  }
}

