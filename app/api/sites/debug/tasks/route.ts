import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// 辅助函数：将 BigInt 转换为字符串
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString()
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }
  
  if (typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value)
    }
    return result
  }
  
  return obj
}

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser()
    
    // 获取所有任务
    const tasks = await prisma.$queryRawUnsafe(`
      SELECT 
        sct.*,
        sc.domain,
        sc.name as site_name,
        sc.analysis_status,
        sc.config_json IS NOT NULL as has_config
      FROM site_crawl_tasks sct
      JOIN site_candidates sc ON sct.site_id = sc.id
      ORDER BY sct.created_at DESC
      LIMIT 50
    `) as any[]
    
    // 获取任务统计
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        status,
        COUNT(*) as count
      FROM site_crawl_tasks
      GROUP BY status
    `) as any[]
    
    // 获取结果统计
    const resultStats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(DISTINCT site_id) as sites_with_results
      FROM site_crawl_results
    `) as any[]
    
    // 序列化 BigInt 值
    const serializedTasks = serializeBigInt(tasks)
    const serializedStats = serializeBigInt(stats)
    const serializedResultStats = serializeBigInt(resultStats)
    
    return NextResponse.json({
      success: true,
      data: {
        tasks: serializedTasks,
        stats: serializedStats,
        resultStats: serializedResultStats[0] || { total_results: 0, sites_with_results: 0 },
      },
    })
  } catch (error: any) {
    console.error('[DebugTasksAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

