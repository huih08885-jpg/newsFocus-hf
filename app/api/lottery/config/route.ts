import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'

/**
 * 获取用户配置
 * GET /api/lottery/config?method=statistical
 * 
 * 业务逻辑：获取用户保存的预测配置，用于恢复之前的设置
 * 技术实现：从lottery_user_configs表查询用户配置
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
    const method = searchParams.get('method') || 'statistical'

    const config = await prisma.lotteryUserConfig.findUnique({
      where: {
        userId: user.id
      }
    })

    // 如果找到配置且方法匹配，返回配置
    if (config && config.method === method) {
      return NextResponse.json({
        success: true,
        data: {
          config: config.config,
          method: config.method,
          updatedAt: config.updatedAt
        }
      })
    }

    // 如果没有找到配置，返回默认配置
    const defaultConfigs: Record<string, any> = {
      statistical: {
        periods: 100,
        numPredictions: 5,
        deterministic: false,
        strategyWeights: {
          conservative: 0.4,
          balanced: 0.4,
          aggressive: 0.2
        }
      },
      ai: {
        periods: 100,
        temperature: 0.7,
        maxTokens: 2000,
        useFallback: true
      },
      ml: {
        periods: 100,
        featureWeights: {
          frequency: 0.3,
          omission: 0.2,
          hot: 0.2,
          cold: 0.15,
          highOmission: 0.15
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        config: defaultConfigs[method] || defaultConfigs.statistical,
        method,
        updatedAt: null
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryConfigAPI', {
      endpoint: '/api/lottery/config'
    })
  }
}

/**
 * 保存用户配置
 * POST /api/lottery/config
 * 
 * 业务逻辑：保存用户的预测配置，下次使用时自动恢复
 * 技术实现：使用upsert保存或更新用户配置
 */
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

    const body = await request.json().catch(() => ({}))
    const { method, config } = body

    if (!method || !config) {
      return NextResponse.json(
        {
          success: false,
          error: 'method和config参数不能为空'
        },
        { status: 400 }
      )
    }

    if (!['statistical', 'ai', 'ml', 'comprehensive'].includes(method)) {
      return NextResponse.json(
        {
          success: false,
          error: 'method必须是statistical、ai、ml或comprehensive之一'
        },
        { status: 400 }
      )
    }

    const savedConfig = await prisma.lotteryUserConfig.upsert({
      where: {
        userId: user.id
      },
      create: {
        userId: user.id,
        method,
        config: config as any
      },
      update: {
        method,
        config: config as any
      }
    })

    logger.info('保存用户配置', 'LotteryConfigAPI', {
      userId: user.id,
      method
    })

    return NextResponse.json({
      success: true,
      data: {
        id: savedConfig.id,
        method: savedConfig.method,
        config: savedConfig.config,
        updatedAt: savedConfig.updatedAt
      }
    })

  } catch (error) {
    return handleError(error, 'LotteryConfigAPI', {
      endpoint: '/api/lottery/config'
    })
  }
}

