import { NextRequest, NextResponse } from 'next/server'
import { DemandRadarService } from '@/lib/services/demand-radar'

/**
 * 定时任务：每天自动执行需求雷达
 * GET /api/cron/demand-radar
 * 
 * ========== 已注释：需求雷达模块相关API ==========
 */
export async function GET(request: NextRequest) {
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
  // 验证Cron Secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[DemandRadar Cron] 开始执行定时任务...')

    const service = new DemandRadarService()
    const result = await service.runTask({
      platforms: ['reddit', 'producthunt', 'hackernews'], // 默认平台
      hoursBack: 24,
      maxResultsPerPlatform: 100,
    })

    console.log(`[DemandRadar Cron] 任务完成: ${result.sourcesCount} 条数据源, ${result.demandsCount} 个需求`)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[DemandRadar Cron] 任务执行失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : '未知错误',
        },
      },
      { status: 500 }
    )
  }
  ========== 原始代码结束 ========== */
}

