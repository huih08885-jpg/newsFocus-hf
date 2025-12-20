import { PrismaClient } from '@prisma/client'

interface CleanupOptions {
  olderThanMinutes?: number
  taskId?: string
  reason?: string
}

export async function cleanupCrawlTasks(
  prisma: PrismaClient,
  { olderThanMinutes = 30, taskId, reason }: CleanupOptions = {}
) {
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - olderThanMinutes * 60 * 1000)

  const where: any = {
    status: {
      in: ['pending', 'running'],
    },
  }

  if (taskId) {
    where.id = taskId
  } else {
    where.createdAt = {
      lt: cutoffTime,
    }
  }

  const stuckTasks = await prisma.crawlTask.findMany({
    where,
  })

  if (stuckTasks.length === 0) {
    return { cleanedCount: 0, cleanedTasks: [] }
  }

  const message =
    reason ||
    (taskId
      ? '任务已被用户强制结束'
      : `任务已运行超过 ${olderThanMinutes} 分钟，自动清理`)

  const result = await prisma.crawlTask.updateMany({
    where: {
      id: {
        in: stuckTasks.map((t) => t.id),
      },
    },
    data: {
      status: 'failed',
      completedAt: now,
      errorMessage: message,
    },
  })

  return {
    cleanedCount: result.count,
    cleanedTasks: stuckTasks,
    message,
  }
}

