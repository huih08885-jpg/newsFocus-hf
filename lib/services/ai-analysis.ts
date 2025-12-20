/**
 * AI 分析服务
 * 整合语料生成和 DeepSeek AI 分析
 */

import { PrismaClient } from '@prisma/client'
import { CorpusGenerator } from './corpus-generator'
import { deepSeekAI } from './deepseek-ai'

export type AnalysisType = 'personal' | 'trend' | 'business'
export type SourceType = 'keyword' | 'site_group'

export interface CreateAnalysisRequest {
  type: AnalysisType
  sourceType: SourceType
  sourceId: string
  customPrompt?: string
  startDate?: Date
  endDate?: Date
  maxItems?: number
}

export interface AnalysisResult {
  id: string
  type: AnalysisType
  sourceType: SourceType
  sourceId: string
  sourceName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  corpus?: string
  result?: any
  errorMessage?: string
  tokenUsage?: number
  itemCount: number
  createdAt: Date
  completedAt?: Date
}

export class AIAnalysisService {
  private corpusGenerator: CorpusGenerator

  constructor(private prisma: PrismaClient) {
    this.corpusGenerator = new CorpusGenerator(prisma)
  }

  /**
   * 创建分析任务
   */
  async createAnalysis(
    userId: string,
    request: CreateAnalysisRequest
  ): Promise<{ taskId: string }> {
    // 检查用户配额
    const canAnalyze = await this.checkUserQuota(userId)
    if (!canAnalyze.allowed) {
      throw new Error(canAnalyze.reason || '分析次数已用完')
    }

    // 生成语料
    let corpusResult
    try {
      corpusResult = await this.corpusGenerator.generate(
        request.sourceType,
        request.sourceId,
        {
          startDate: request.startDate,
          endDate: request.endDate,
          maxItems: request.maxItems,
        }
      )
    } catch (error) {
      throw new Error(`生成语料失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }

    // 创建分析任务
    const task = await this.prisma.analysisTask.create({
      data: {
        userId,
        type: request.type,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        corpus: corpusResult.corpus,
        prompt: request.customPrompt,
        status: 'pending',
      },
    })

    // 异步执行分析
    this.executeAnalysis(task.id).catch(error => {
      console.error(`[AIAnalysis] 分析任务 ${task.id} 执行失败:`, error)
    })

    // 增加使用量
    await this.incrementUsage(userId)

    return { taskId: task.id }
  }

  /**
   * 执行分析任务
   */
  private async executeAnalysis(taskId: string): Promise<void> {
    // 更新状态为处理中
    await this.prisma.analysisTask.update({
      where: { id: taskId },
      data: { status: 'processing' },
    })

    try {
      const task = await this.prisma.analysisTask.findUnique({
        where: { id: taskId },
      })

      if (!task) {
        throw new Error('任务不存在')
      }

      // 调用 DeepSeek AI 分析
      const analysisResult = await deepSeekAI.analyzeContent(
        task.type as AnalysisType,
        task.corpus,
        task.prompt || undefined
      )

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || '分析失败')
      }

      // 更新任务状态
      await this.prisma.analysisTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: analysisResult.result,
          tokenUsage: analysisResult.tokenUsage,
          completedAt: new Date(),
        },
      })
    } catch (error) {
      // 更新任务状态为失败
      await this.prisma.analysisTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : '未知错误',
          completedAt: new Date(),
        },
      })
      throw error
    }
  }

  /**
   * 获取分析任务
   */
  async getAnalysis(taskId: string, userId: string): Promise<AnalysisResult | null> {
    const task = await this.prisma.analysisTask.findFirst({
      where: {
        id: taskId,
        userId, // 确保只能访问自己的任务
      },
    })

    if (!task) {
      return null
    }

    // 获取来源名称
    let sourceName = '未知来源'
    try {
      if (task.sourceType === 'keyword') {
        const group = await this.prisma.keywordGroup.findUnique({
          where: { id: task.sourceId },
        })
        sourceName = group?.name || '未命名关键词组'
      } else {
        const group = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(`
          SELECT name FROM site_groups WHERE id = $1::text
        `, task.sourceId).then(r => r[0]?.name || '未命名分组')
        sourceName = group
      }
    } catch (error) {
      console.warn(`[AIAnalysis] 获取来源名称失败:`, error)
    }

    // 计算语料中的项目数量（简单估算）
    const itemCount = (task.corpus.match(/--- 新闻 \d+ ---/g) || []).length

    return {
      id: task.id,
      type: task.type as AnalysisType,
      sourceType: task.sourceType as SourceType,
      sourceId: task.sourceId,
      sourceName,
      status: task.status as any,
      corpus: task.corpus,
      result: task.result as any,
      errorMessage: task.errorMessage || undefined,
      tokenUsage: task.tokenUsage || undefined,
      itemCount,
      createdAt: task.createdAt,
      completedAt: task.completedAt || undefined,
    }
  }

  /**
   * 获取用户的分析任务列表
   */
  async getUserAnalyses(
    userId: string,
    options: {
      type?: AnalysisType
      status?: string
      page?: number
      pageSize?: number
    } = {}
  ): Promise<{
    tasks: AnalysisResult[]
    total: number
    page: number
    pageSize: number
  }> {
    const { type, status, page = 1, pageSize = 20 } = options

    const where: any = { userId }
    if (type) {
      where.type = type
    }
    if (status) {
      where.status = status
    }

    const [tasks, total] = await Promise.all([
      this.prisma.analysisTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.analysisTask.count({ where }),
    ])

    // 批量获取来源名称
    const tasksWithNames = await Promise.all(
      tasks.map(async task => {
        let sourceName = '未知来源'
        try {
          if (task.sourceType === 'keyword') {
            const group = await this.prisma.keywordGroup.findUnique({
              where: { id: task.sourceId },
            })
            sourceName = group?.name || '未命名关键词组'
          } else {
            const group = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(`
              SELECT name FROM site_groups WHERE id = $1::text
            `, task.sourceId).then(r => r[0]?.name || '未命名分组')
            sourceName = group
          }
        } catch (error) {
          console.warn(`[AIAnalysis] 获取来源名称失败:`, error)
        }

        const itemCount = (task.corpus.match(/--- 新闻 \d+ ---/g) || []).length

        return {
          id: task.id,
          type: task.type as AnalysisType,
          sourceType: task.sourceType as SourceType,
          sourceId: task.sourceId,
          sourceName,
          status: task.status as any,
          corpus: undefined, // 列表不返回完整语料
          result: task.status === 'completed' ? task.result : undefined,
          errorMessage: task.errorMessage || undefined,
          tokenUsage: task.tokenUsage || undefined,
          itemCount,
          createdAt: task.createdAt,
          completedAt: task.completedAt || undefined,
        }
      })
    )

    return {
      tasks: tasksWithNames,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 检查用户配额
   */
  async checkUserQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    // 获取或创建用户订阅
    let subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      // 创建免费订阅
      subscription = await this.prisma.userSubscription.create({
        data: {
          userId,
          plan: 'free',
          analysisQuota: 3,
          usedQuota: 0,
          quotaResetAt: new Date(),
        },
      })
    }

    // 检查是否需要重置配额（每月重置）
    const now = new Date()
    const resetAt = new Date(subscription.quotaResetAt)
    const shouldReset = now.getTime() - resetAt.getTime() > 30 * 24 * 60 * 60 * 1000

    if (shouldReset) {
      subscription = await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          usedQuota: 0,
          quotaResetAt: now,
        },
      })
    }

    // 检查配额
    const remaining = subscription.analysisQuota - subscription.usedQuota
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: subscription.plan === 'free'
          ? '免费版每月分析次数已用完，请升级到专业版'
          : '分析次数已用完',
      }
    }

    return { allowed: true }
  }

  /**
   * 增加使用量
   */
  private async incrementUsage(userId: string): Promise<void> {
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        usedQuota: {
          increment: 1,
        },
      },
    })
  }

  /**
   * 获取用户订阅信息
   */
  async getUserSubscription(userId: string) {
    let subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      subscription = await this.prisma.userSubscription.create({
        data: {
          userId,
          plan: 'free',
          analysisQuota: 3,
          usedQuota: 0,
          quotaResetAt: new Date(),
        },
      })
    }

    // 检查是否需要重置配额
    const now = new Date()
    const resetAt = new Date(subscription.quotaResetAt)
    const shouldReset = now.getTime() - resetAt.getTime() > 30 * 24 * 60 * 60 * 1000

    if (shouldReset) {
      subscription = await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          usedQuota: 0,
          quotaResetAt: now,
        },
      })
    }

    return {
      plan: subscription.plan,
      quota: subscription.analysisQuota,
      used: subscription.usedQuota,
      remaining: subscription.analysisQuota - subscription.usedQuota,
      resetAt: subscription.quotaResetAt,
    }
  }
}

