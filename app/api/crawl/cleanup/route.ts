import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { cleanupCrawlTasks } from '@/lib/services/crawl-task-manager'

/**
 * 清理卡住的爬取任务
 * POST /api/crawl/cleanup
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function POST(request: NextRequest) {
  // ========== 已注释：爬虫管理模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '爬虫管理模块已禁用',
      },
    },
    { status: 503 }
  )
  
  // ========== 原始代码已注释 ==========
  // try {
  //   const body = await request.json().catch(() => ({}))
  //   const { olderThanMinutes = 30, taskId, reason } = body
  //
  //   const cleanupResult = await cleanupCrawlTasks(prisma, {
  //     olderThanMinutes,
  //     taskId,
  //     reason,
  //   })
  //
  //   return NextResponse.json({
  //     success: true,
  //     data: {
  //       message:
  //         cleanupResult.cleanedCount > 0
  //           ? `成功清理 ${cleanupResult.cleanedCount} 个任务`
  //           : '没有发现需要清理的任务',
  //       cleanedCount: cleanupResult.cleanedCount,
  //       cleanedTasks: cleanupResult.cleanedTasks.map((t) => ({
  //         id: t.id,
  //         status: t.status,
  //         createdAt: t.createdAt,
  //       })),
  //     },
  //   })
  // } catch (error) {
  //   console.error('Error cleaning up crawl tasks:', error)
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error: {
  //         code: 'CLEANUP_ERROR',
  //         message: error instanceof Error ? error.message : '清理失败',
  //       },
  //     },
  //     { status: 500 }
  //   )
  // }
}

/**
 * 获取所有正在进行的任务
 * GET /api/crawl/cleanup
 * 
 * ========== 已注释：爬虫管理模块相关API ==========
 */
export async function GET(request: NextRequest) {
  // ========== 已注释：爬虫管理模块相关API ==========
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: '爬虫管理模块已禁用',
      },
    },
    { status: 503 }
  )
  
  // ========== 原始代码已注释 ==========
  // try {
  //   const runningTasks = await prisma.crawlTask.findMany({
  //     where: {
  //       status: {
  //         in: ['pending', 'running'],
  //       },
  //     },
  //     orderBy: {
  //       createdAt: 'desc',
  //     },
  //   })
  //
  //   return NextResponse.json({
  //     success: true,
  //     data: {
  //       tasks: runningTasks.map((t) => ({
  //         id: t.id,
  //         status: t.status,
  //         createdAt: t.createdAt,
  //         startedAt: t.startedAt,
  //         successCount: t.successCount,
  //         failedCount: t.failedCount,
  //       })),
  //       count: runningTasks.length,
  //     },
  //   })
  // } catch (error) {
  //   console.error('Error fetching running tasks:', error)
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error: {
  //         code: 'QUERY_ERROR',
  //         message: error instanceof Error ? error.message : '查询失败',
  //       },
  //     },
  //     { status: 500 }
  //   )
  // }
}

