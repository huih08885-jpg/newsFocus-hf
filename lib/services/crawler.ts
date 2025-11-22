import { PrismaClient } from '@prisma/client'
import { getCrawler, getRegisteredPlatforms } from './crawlers'
import type { CrawlResult, NewsItem } from './crawlers/base'

export class CrawlerService {
  private prisma: PrismaClient
  private requestInterval: number

  constructor(
    prisma: PrismaClient,
    options?: {
      requestInterval?: number
    }
  ) {
    this.prisma = prisma
    this.requestInterval = options?.requestInterval ?? 1000
  }

  /**
   * 爬取单个平台数据
   * 使用平台特定的爬虫实现
   */
  async fetchPlatformData(
    platformId: string,
    maxRetries: number = 2
  ): Promise<CrawlResult> {
    // 获取平台爬虫
    const crawler = getCrawler(platformId)
    
    if (!crawler) {
      const registeredPlatforms = getRegisteredPlatforms().join(', ')
      console.warn(`[${platformId}] ⚠️ 爬虫未实现。已注册的平台: ${registeredPlatforms || '无'}`)
      return {
        success: false,
        platformId,
        error: `平台 ${platformId} 的爬虫未实现。已注册的平台: ${registeredPlatforms || '无'}`,
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${platformId}] 正在爬取 (尝试 ${attempt + 1}/${maxRetries + 1})`)
        
        const result = await crawler.crawl()
        
        if (result.success && result.data) {
          console.log(`[${platformId}] ✓ 爬取成功，获取到 ${result.data.length} 条新闻`)
        } else {
          console.error(`[${platformId}] ✗ 爬取失败:`, result.error)
        }
        
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorStack = error instanceof Error ? error.stack : undefined
        
        console.error(`[${platformId}] ✗ 爬取失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, errorMessage)
        
        // 只在最后一次尝试时输出详细堆栈
        if (attempt === maxRetries && errorStack) {
          console.error(`[${platformId}] 错误堆栈:`, errorStack)
        }
        
        if (attempt === maxRetries) {
          return {
            success: false,
            platformId,
            error: errorMessage,
          }
        }
        
        // 指数退避重试
        const delayMs = 2000 * Math.pow(2, attempt) // 2s, 4s, 8s
        console.log(`[${platformId}] ${delayMs}ms 后重试...`)
        await this.delay(delayMs)
      }
    }

    return {
      success: false,
      platformId,
      error: 'Max retries exceeded',
    }
  }

  /**
   * 爬取所有启用的平台
   */
  async crawlAllPlatforms(
    platformIds?: string[],
    onProgress?: (progress: {
      current: number
      total: number
      currentPlatform: string
      successCount: number
      failedCount: number
      failedPlatforms?: Array<{ platformId: string; error: string }>
    }) => void
  ): Promise<{
    successCount: number
    failedCount: number
    results: CrawlResult[]
  }> {
    let platforms
    
    if (platformIds && platformIds.length > 0) {
      platforms = await this.prisma.platform.findMany({
        where: {
          platformId: { in: platformIds },
          enabled: true,
        },
      })
    } else {
      platforms = await this.prisma.platform.findMany({
        where: { enabled: true },
      })
    }

    const results: CrawlResult[] = []
    let successCount = 0
    let failedCount = 0
    const failedPlatforms: Array<{ platformId: string; error: string }> = []

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i]
      
      // 更新进度
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: platforms.length,
          currentPlatform: platform.name,
          successCount,
          failedCount,
          failedPlatforms: [...failedPlatforms],
        })
      }

      const result = await this.fetchPlatformData(platform.platformId)
      results.push(result)

      if (result.success && result.data && result.data.length > 0) {
        successCount++
        // 保存到数据库
        await this.saveNewsItems(platform.platformId, result.data)
        console.log(`[${platform.platformId}] ✓ 成功爬取并保存 ${result.data.length} 条新闻`)
      } else {
        failedCount++
        const errorMsg = result.error || '未知错误'
        console.warn(`[${platform.platformId}] ✗ 爬取失败: ${errorMsg}`)
        failedPlatforms.push({
          platformId: platform.platformId,
          error: errorMsg,
        })
      }

      // 请求间隔
      if (i < platforms.length - 1) {
        await this.delay(this.requestInterval)
      }
    }

    return {
      successCount,
      failedCount,
      results,
    }
  }

  /**
   * 保存新闻数据到数据库
   */
  private async saveNewsItems(
    platformId: string,
    items: Array<{
      title: string
      url?: string
      mobileUrl?: string
      rank: number
    }>
  ): Promise<void> {
    const crawledAt = new Date()

    for (const item of items) {
      try {
        await this.prisma.newsItem.upsert({
          where: {
            platformId_title_crawledAt: {
              platformId,
              title: item.title,
              crawledAt,
            },
          },
          update: {
            rank: item.rank,
            url: item.url,
            mobileUrl: item.mobileUrl,
          },
          create: {
            platformId,
            title: item.title,
            url: item.url,
            mobileUrl: item.mobileUrl,
            rank: item.rank,
            crawledAt,
          },
        })
      } catch (error) {
        // 忽略重复键错误
        console.error(`Error saving news item: ${item.title}`, error)
      }
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

