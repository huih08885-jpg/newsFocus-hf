import { NextRequest, NextResponse } from 'next/server'
import { DemandRadarService } from '@/lib/services/demand-radar'
import { handleError } from '@/lib/utils/error-handler'
import { logger } from '@/lib/utils/logger'

/**
 * 手动触发需求雷达任务
 * POST /api/demand-radar/run
 * 
 * ========== 已注释：需求雷达模块相关API ==========
 */
export async function POST(request: NextRequest) {
  // ========== 已注释：需求雷达模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '需求雷达模块已禁用',
      },
    },
    { status: 503 }
  )
  
  /* ========== 原始代码已注释 ==========
  try {
    const body = await request.json().catch(() => ({}))
    const { platforms, hoursBack, maxResultsPerPlatform } = body

    logger.info('收到需求雷达任务请求', 'DemandRadarAPI', { platforms, hoursBack, maxResultsPerPlatform })

    const service = new DemandRadarService()
    const result = await service.runTask({
      platforms,
      hoursBack,
      maxResultsPerPlatform,
    })

    logger.info('需求雷达任务执行成功', 'DemandRadarAPI', result)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleError(error, 'DemandRadarAPI', '需求雷达任务执行失败')
  }
  ========== 原始代码结束 ========== */
}

