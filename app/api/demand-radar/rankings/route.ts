import { NextRequest, NextResponse } from 'next/server'
import { DemandRadarService } from '@/lib/services/demand-radar'
import { prisma } from '@/lib/db/prisma'

/**
 * 获取需求榜单
 * GET /api/demand-radar/rankings?date=2024-01-01
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
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()

    const service = new DemandRadarService()
    const rankings = await service.getTodayRankings()

    // 格式化数据
    const formatted = rankings.map((r) => ({
      rank: r.rank,
      demand: r.demand.cleanedText,
      frequency: r.frequency,
      trend: r.trend,
      notes: r.notes,
      category: r.demand.category,
      keywords: r.demand.keywords,
      createdAt: r.demand.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        date: date.toISOString().split('T')[0],
        rankings: formatted,
        total: formatted.length,
      },
    })
  } catch (error) {
    console.error('[DemandRadar API] 获取榜单失败:', error)
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

