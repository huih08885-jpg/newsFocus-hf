import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * 定时任务：清理旧日志文件
 * GET /api/cron/cleanup-logs
 */
export async function GET(request: NextRequest) {
  // 验证Cron Secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    logger.info('开始清理旧日志文件', 'LogCleanup')
    
    // 清理30天前的日志
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30天
    logger.cleanup(maxAge)
    
    logger.info('日志清理完成', 'LogCleanup')
    
    return NextResponse.json({
      success: true,
      message: '日志清理完成',
    })
  } catch (error) {
    logger.error('日志清理失败', error instanceof Error ? error : new Error(String(error)), 'LogCleanup')
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
}

