#!/usr/bin/env tsx
/**
 * 清理卡住的爬虫任务
 * 运行示例：
 *   npm run cleanup:crawl-tasks
 *   npm run cleanup:crawl-tasks -- --minutes 15
 *   npm run cleanup:crawl-tasks -- --task <taskId>
 */

import { PrismaClient } from '@prisma/client'
import { cleanupCrawlTasks } from '../lib/services/crawl-task-manager'

const prisma = new PrismaClient()

interface CliOptions {
  taskId?: string
  olderThanMinutes: number
  reason?: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let taskId: string | undefined
  let olderThanMinutes = Number(process.env.CRAWL_TASK_TIMEOUT_MINUTES) || 30
  let reason = process.env.CRAWL_TASK_CLEANUP_REASON

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if ((arg === '--task' || arg === '-t') && args[i + 1]) {
      taskId = args[i + 1]
      i++
      continue
    }
    if ((arg === '--minutes' || arg === '-m') && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        olderThanMinutes = parsed
      }
      i++
      continue
    }
    if ((arg === '--reason' || arg === '-r') && args[i + 1]) {
      reason = args[i + 1]
      i++
      continue
    }
  }

  return { taskId, olderThanMinutes, reason }
}

async function main() {
  const options = parseArgs()
  console.log('🧹 开始清理爬虫任务...')
  console.log(
    `   条件: ${options.taskId ? `taskId=${options.taskId}` : `超过 ${options.olderThanMinutes} 分钟`}`
  )

  try {
    const result = await cleanupCrawlTasks(prisma, options)
    if (result.cleanedCount === 0) {
      console.log('✅ 没有需要清理的任务')
    } else {
      console.log(`✅ 已清理 ${result.cleanedCount} 个任务`)
      result.cleanedTasks.forEach((task) => {
        console.log(
          `   - ${task.id} (${task.status}) startedAt=${task.startedAt?.toISOString()} createdAt=${task.createdAt.toISOString()}`
        )
      })
      console.log(`   原因: ${result.message}`)
    }
  } catch (error: any) {
    console.error('❌ 清理失败:', error?.message || error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()


