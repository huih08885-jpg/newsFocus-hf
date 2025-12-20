import { NextRequest, NextResponse } from 'next/server'
import { LotteryAnalysisService } from '@/lib/services/lottery-analysis'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import { getCurrentUser } from '@/lib/auth'

/**
 * 执行彩票分析
 * POST /api/lottery/analysis
 * 
 * 业务逻辑：执行指定类型的分析（频率、遗漏、分布、模式），并将结果保存到数据库
 * 技术实现：调用LotteryAnalysisService，将结果序列化为JSON保存
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
    const { type, periods = 100, config = {} } = body

    if (!type || !['frequency', 'omission', 'distribution', 'pattern', 'comprehensive'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: '分析类型无效，必须是: frequency, omission, distribution, pattern, comprehensive'
        },
        { status: 400 }
      )
    }

    if (periods < 10) {
      return NextResponse.json(
        {
          success: false,
          error: '历史数据期数不能少于10期'
        },
        { status: 400 }
      )
    }

    logger.info(`开始执行${type}分析`, 'LotteryAnalysisAPI', { type, periods, config })

    const analysisService = new LotteryAnalysisService()
    let result: any
    let summary: string

    // 执行对应类型的分析
    switch (type) {
      case 'frequency':
        result = await analysisService.analyzeFrequency(periods)
        summary = `频率分析：热号${result.hotNumbers.length}个，冷号${result.coldNumbers.length}个，温号${result.warmNumbers.length}个`
        break
      case 'omission':
        result = await analysisService.analyzeOmission(periods)
        summary = `遗漏分析：高遗漏号码${result.highOmission.length}个，低遗漏号码${result.lowOmission.length}个`
        break
      case 'distribution':
        result = await analysisService.analyzeDistribution(periods)
        summary = `分布分析：区间分布${JSON.stringify(result.zoneDistribution)}，奇偶比${result.oddEvenRatio.odd.toFixed(2)}:${result.oddEvenRatio.even.toFixed(2)}`
        break
      case 'pattern':
        result = await analysisService.identifyPatterns(periods)
        summary = `模式识别：连号频率${result.consecutiveNumbers.frequency.toFixed(2)}，常见组合${result.combinationPatterns.length}个`
        break
      case 'comprehensive':
        result = await analysisService.comprehensiveAnalysis(periods)
        summary = `综合分析：包含频率、遗漏、分布、模式四种分析`
        break
      default:
        throw new Error(`不支持的分析类型: ${type}`)
    }

    // 保存到数据库
    const savedAnalysis = await prisma.lotteryAnalysis.create({
      data: {
        userId: user.id,
        type,
        periods,
        config: config as any,
        result: result as any,
        summary
      }
    })

    logger.info(`${type}分析完成并已保存`, 'LotteryAnalysisAPI', {
      analysisId: savedAnalysis.id,
      type
    })

    return NextResponse.json({
      success: true,
      data: {
        id: savedAnalysis.id,
        type,
        periods,
        result,
        summary,
        createdAt: savedAnalysis.createdAt
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryAnalysisAPI', {
      endpoint: '/api/lottery/analysis'
    })
  }
}

/**
 * 获取分析历史
 * GET /api/lottery/analysis
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {
      userId: user.id // 只查询当前用户的分析
    }
    if (type) {
      where.type = type
    }

    const [analyses, total] = await Promise.all([
      prisma.lotteryAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          periods: true,
          config: true,
          result: true,
          summary: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.lotteryAnalysis.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        analyses,
        total,
        limit,
        offset
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryAnalysisAPI', {
      endpoint: '/api/lottery/analysis'
    })
  }
}

