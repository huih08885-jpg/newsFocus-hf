import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  // 验证Cron Secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const retentionDays = 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // 删除旧数据
    const [deletedNews, deletedMatches, deletedAppearances, deletedPushRecords] =
      await Promise.all([
        prisma.newsItem.deleteMany({
          where: {
            crawledAt: { lt: cutoffDate },
          },
        }),
        prisma.newsMatch.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
          },
        }),
        prisma.newsAppearance.deleteMany({
          where: {
            appearedAt: { lt: cutoffDate },
          },
        }),
        prisma.pushRecord.deleteMany({
          where: {
            pushedAt: { lt: cutoffDate },
          },
        }),
      ])

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      data: {
        deletedNews: deletedNews.count,
        deletedMatches: deletedMatches.count,
        deletedAppearances: deletedAppearances.count,
        deletedPushRecords: deletedPushRecords.count,
      },
    })
  } catch (error) {
    console.error('Cron cleanup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

