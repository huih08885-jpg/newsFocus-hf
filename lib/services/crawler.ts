import { PrismaClient, Prisma } from '@prisma/client'
import { getCrawler, getRegisteredPlatforms } from './crawlers'
import type { CrawlResult, NewsItem } from './crawlers/base'
import { MatcherService } from './matcher'
import { CalculatorService } from './calculator'
import { ArticleContentExtractor } from './article-content'
import { ConfigurableHtmlCrawler, ConfigurableHtmlCrawlerConfig } from './crawlers/configurable-html'

export class CrawlerService {
  private prisma: PrismaClient
  private requestInterval: number
  private matcherService: MatcherService | null
  private calculatorService: CalculatorService | null
  private enableRealtimeMatching: boolean
  private articleContentExtractor: ArticleContentExtractor
  private userId?: string

  constructor(
    prisma: PrismaClient,
    options?: {
      requestInterval?: number
      enableRealtimeMatching?: boolean
      keywordGroupIds?: string[]
      userId?: string
    }
  ) {
    this.prisma = prisma
    this.requestInterval = options?.requestInterval ?? 1000
    
    // 实时匹配功能
    this.enableRealtimeMatching = options?.enableRealtimeMatching ?? false
    if (this.enableRealtimeMatching) {
      this.matcherService = new MatcherService(prisma)
      this.calculatorService = new CalculatorService()
    } else {
      this.matcherService = null
      this.calculatorService = null
    }

    this.articleContentExtractor = new ArticleContentExtractor()
    this.userId = options?.userId
  }

  /**
   * 爬取单个平台数据
   * 使用平台特定的爬虫实现
   */
  async fetchPlatformData(
    platform: {
      platformId: string
      name: string
      crawlerType: string
    },
    maxRetries: number = 2,
    options?: {
      keywords?: string[]
      useSearchMode?: boolean
    },
    configOverride?: Prisma.JsonValue | null
  ): Promise<CrawlResult> {
    const crawler = this.resolveCrawler(platform, configOverride)

    if (!crawler) {
      const registeredPlatforms = getRegisteredPlatforms().join(', ')
      console.warn(
        `[${platform.platformId}] ⚠️ 爬虫未实现。已注册的平台: ${registeredPlatforms || '无'}`
      )
      return {
        success: false,
        platformId: platform.platformId,
        error: `平台 ${platform.platformId} 的爬虫未实现。已注册的平台: ${registeredPlatforms || '无'}`,
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const mode =
          options?.useSearchMode && options?.keywords && options.keywords.length > 0
            ? 'search'
            : 'hot'
        console.log(
          `[${platform.platformId}] 正在爬取 (模式: ${mode}, 尝试 ${attempt + 1}/${
            maxRetries + 1
          })`
        )

        let result: CrawlResult
        if (crawler.crawlWithOptions) {
          result = await crawler.crawlWithOptions({
            keywords: options?.keywords,
            mode: mode as 'hot' | 'search',
            limit: 20,
          })
        } else {
          result = await crawler.crawl()
        }

        if (result.success && result.data) {
          console.log(
            `[${platform.platformId}] ✓ 爬取成功，获取到 ${result.data.length} 条新闻`
          )
        } else {
          console.error(`[${platform.platformId}] ✗ 爬取失败:`, result.error)
        }

        return result
      } catch (error) {
        let errorMessage = '未知错误'
        let errorDetails: any = {}

        if (error instanceof Error) {
          errorMessage = error.message || error.name || '未知错误'
          errorDetails = {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }

          // 网络相关错误
          if (
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')
          ) {
            errorMessage = `网络请求失败: ${error.message}。可能是网络连接问题、服务器无响应或 CORS 限制。`
          }
          // JSON解析错误
          else if (error.message.includes('JSON') || error.message.includes('Unexpected token') || error.message.includes('Unexpected end')) {
            errorMessage = `数据解析失败: ${error.message}。API 可能返回了非 JSON 格式的数据或数据格式已变更。`
          }
          // HTTP错误
          else if (error.message.includes('HTTP') || error.message.includes('404') || error.message.includes('500') || error.message.includes('403')) {
            errorMessage = `HTTP 错误: ${error.message}。服务器返回了错误状态码，可能是接口地址变更或需要认证。`
          }
          // 超时错误
          else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            errorMessage = `请求超时: ${error.message}。服务器响应时间过长，可能是网络延迟或服务器负载过高。`
          }
          // 其他错误，至少显示错误类型和消息
          else if (error.name && error.message) {
            errorMessage = `${error.name}: ${error.message}`
          }
        } else if (typeof error === 'string') {
          errorMessage = error || '未知错误'
        } else if (error && typeof error === 'object') {
          try {
            errorMessage = JSON.stringify(error)
          } catch {
            errorMessage = '对象序列化失败，请查看控制台日志获取详细信息'
          }
        }

        console.error(
          `[${platform.platformId}] ✗ 爬取失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`,
          errorMessage
        )
        console.error(`[${platform.platformId}] 错误详情:`, errorDetails)

        if (attempt === maxRetries && errorDetails.stack) {
          console.error(`[${platform.platformId}] 错误堆栈:`, errorDetails.stack)
        }

        if (attempt === maxRetries) {
          return {
            success: false,
            platformId: platform.platformId,
            error: errorMessage,
          }
        }

        const delayMs = 2000 * Math.pow(2, attempt)
        console.log(`[${platform.platformId}] ${delayMs}ms 后重试...`)
        await this.delay(delayMs)
      }
    }

    return {
      success: false,
      platformId: platform.platformId,
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
      fetchedNewsCount: number
      failedPlatforms?: Array<{ platformId: string; error: string }>
    }) => void,
    keywordGroupIds?: string[],
    keywordGroups?: Array<{ id: string; words: string[] }>,
    customKeywords?: string[], // 自定义关键词
    isCustomKeywordsMode?: boolean // 标记是否使用自定义关键词模式
  ): Promise<{
    successCount: number
    failedCount: number
    results: CrawlResult[]
  }> {
    const platforms = await this.prisma.platform.findMany({
      where: platformIds && platformIds.length > 0
        ? { platformId: { in: platformIds }, enabled: true }
        : { enabled: true },
      select: {
        platformId: true,
        name: true,
        crawlerType: true,
        crawlerConfig: true,
      },
    })

    // 从关键词组中获取自定义网站配置
    const customWebsites: Array<{
      id: string
      name: string
      platformId: string
      keywordGroupId: string
      config: ConfigurableHtmlCrawlerConfig
      keywords: string[]
    }> = []

    if (keywordGroupIds && keywordGroupIds.length > 0) {
      const keywordGroupsWithWebsites = await this.prisma.keywordGroup.findMany({
        where: {
          id: { in: keywordGroupIds },
          enabled: true,
        },
        select: {
          id: true,
          name: true,
          words: true,
          customWebsites: true,
        },
      })

      for (const group of keywordGroupsWithWebsites) {
        if (group.customWebsites && typeof group.customWebsites === 'object') {
          const websites = Array.isArray(group.customWebsites) 
            ? group.customWebsites 
            : [group.customWebsites]
          
          for (const website of websites) {
            if (
              website && 
              typeof website === 'object' &&
              'id' in website &&
              'name' in website &&
              'enabled' in website &&
              'config' in website &&
              website.enabled === true
            ) {
              const websiteConfig = website.config as ConfigurableHtmlCrawlerConfig
              if (websiteConfig && websiteConfig.type === 'html') {
                customWebsites.push({
                  id: String(website.id),
                  name: String(website.name),
                  platformId: `custom-${group.id}-${website.id}`,
                  keywordGroupId: group.id,
                  config: websiteConfig,
                  keywords: group.words || [],
                })
              }
            }
          }
        }
      }
    }

    // 将自定义网站添加到平台列表
    const allPlatforms = [
      ...platforms,
      ...customWebsites.map(ws => ({
        platformId: ws.platformId,
        name: ws.name,
        crawlerType: 'configurable-html' as const,
        crawlerConfig: ws.config as Prisma.JsonValue,
        _isCustom: true,
        _keywordGroupId: ws.keywordGroupId,
        _keywords: ws.keywords,
      })),
    ]

    const userConfigMap = await this.getUserPlatformConfigs(
      platforms.map((p) => p.platformId)
    )

    const results: CrawlResult[] = []
    let successCount = 0
    let failedCount = 0
    let fetchedNewsCount = 0
    const failedPlatforms: Array<{ platformId: string; error: string }> = []

    for (let i = 0; i < allPlatforms.length; i++) {
      const platform = allPlatforms[i]
      const isCustom = (platform as any)._isCustom === true
      const customKeywordGroupId = (platform as any)._keywordGroupId
      const customKeywords = (platform as any)._keywords || []
      
      // 更新进度
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: allPlatforms.length,
          currentPlatform: platform.name,
          successCount,
          failedCount,
          fetchedNewsCount,
          failedPlatforms: [...failedPlatforms],
        })
      }

      // 如果指定了关键词组或自定义关键词，提取所有关键词用于搜索
      let keywords: string[] | undefined
      let useSearchMode = false
      
      // 自定义网站使用其关联的关键词组的关键词
      if (isCustom && customKeywords.length > 0) {
        keywords = customKeywords
        useSearchMode = true
        console.log(`[${platform.platformId}] 自定义网站使用关键词组关键词: ${keywords.join(', ')}`)
      }
      // 优先使用自定义关键词
      else if (customKeywords && customKeywords.length > 0) {
        keywords = customKeywords
        useSearchMode = true
        console.log(`[${platform.platformId}] 使用自定义关键词搜索模式，关键词: ${keywords.join(', ')}`)
      } else if (keywordGroups && keywordGroups.length > 0) {
        // 否则使用关键词组的关键词
        keywords = []
        for (const group of keywordGroups) {
          keywords.push(...group.words)
        }
        // 去重
        keywords = [...new Set(keywords)]
        useSearchMode = keywords.length > 0
        console.log(`[${platform.platformId}] 使用关键词组搜索模式，关键词: ${keywords.join(', ')}`)
      }

      const effectiveConfig = mergeJsonConfig(
        platform.crawlerConfig,
        userConfigMap.get(platform.platformId)
      )

      const result = await this.fetchPlatformData(
        platform,
        2,
        {
          keywords,
          useSearchMode,
        },
        effectiveConfig
      )
      results.push(result)

      if (result.success && result.data && result.data.length > 0) {
        successCount++
        fetchedNewsCount += result.data.length
        // 保存到数据库（带实时匹配）
        // 如果使用自定义关键词模式，不进行关键词组匹配（因为搜索结果本身就是基于关键词的）
        // 只有在使用关键词组模式时才进行匹配
        // 自定义网站的数据需要关联到对应的关键词组
        const targetKeywordGroupIds = isCustom && customKeywordGroupId
          ? [customKeywordGroupId]
          : (isCustomKeywordsMode ? undefined : keywordGroupIds)
        
        await this.saveNewsItems(
          platform.platformId, 
          result.data, 
          targetKeywordGroupIds,
          isCustom ? platform.name : undefined,
          isCustom ? 'configurable-html' : undefined,
          isCustom ? platform.crawlerConfig : undefined
        )
        console.log(`[${platform.platformId}] ✓ 成功爬取并保存 ${result.data.length} 条新闻`)
        
        // 更新进度（包含已获取的新闻数）
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: platforms.length,
            currentPlatform: platform.name,
            successCount,
            failedCount,
            fetchedNewsCount,
            failedPlatforms: [...failedPlatforms],
          })
        }
      } else {
        failedCount++
        // 确保错误信息不为空，提供更详细的错误描述
        let errorMsg = result.error
        if (!errorMsg || errorMsg.trim() === '' || errorMsg === '未知错误') {
          if (result.data && result.data.length === 0) {
            errorMsg = `未获取到任何数据，可能是平台接口返回空结果或页面结构已变更`
          } else {
            errorMsg = `爬取失败：平台 ${platform.name} (${platform.platformId}) 返回了失败状态，请检查平台接口或网络连接`
          }
        }
        console.warn(`[${platform.platformId}] ✗ 爬取失败: ${errorMsg}`)
        failedPlatforms.push({
          platformId: platform.platformId,
          error: errorMsg,
        })
      }

      // 请求间隔
      if (i < allPlatforms.length - 1) {
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
   * 确保平台记录存在（如果不存在则创建）
   */
  private async ensurePlatformExists(
    platformId: string,
    platformName: string,
    crawlerType: string = 'builtin',
    crawlerConfig?: Prisma.JsonValue
  ): Promise<void> {
    try {
      await this.prisma.platform.upsert({
        where: { platformId },
        update: {
          name: platformName,
          enabled: true,
          crawlerType,
          crawlerConfig: crawlerConfig || undefined,
        },
        create: {
          platformId,
          name: platformName,
          enabled: true,
          crawlerType,
          crawlerConfig: crawlerConfig || undefined,
        },
      })
    } catch (error) {
      console.error(`[CrawlerService] 确保平台存在失败 (${platformId}):`, error)
      // 不抛出错误，让后续操作继续
    }
  }

  /**
   * 保存新闻数据到数据库，并实时匹配关键词（如果启用）
   */
  private async saveNewsItems(
    platformId: string,
    items: Array<{
      title: string
      url?: string
      mobileUrl?: string
      rank: number
    }>,
    keywordGroupIds?: string[],
    platformName?: string,
    crawlerType?: string,
    crawlerConfig?: Prisma.JsonValue
  ): Promise<void> {
    const crawledAt = new Date()

    // 如果是自定义网站，确保平台记录存在
    if (platformId.startsWith('custom-') && platformName) {
      await this.ensurePlatformExists(
        platformId,
        platformName,
        crawlerType || 'configurable-html',
        crawlerConfig
      )
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      let content = item.content
      let publishedAt =
        (typeof item.publishedAt === 'string' || item.publishedAt instanceof Date)
          ? new Date(item.publishedAt)
          : undefined

      try {
        if (!content || !publishedAt) {
          const extraction = await this.articleContentExtractor.extract(item.url || item.mobileUrl)
          if (extraction) {
            if (!content) {
              content = extraction.content || undefined
            }
            if (!publishedAt && extraction.publishedAt) {
              publishedAt = extraction.publishedAt
            }
          }
        }

        const newsItem = await this.prisma.newsItem.upsert({
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
            content,
            publishedAt,
          },
          create: {
            platformId,
            title: item.title,
            url: item.url,
            mobileUrl: item.mobileUrl,
            content,
            publishedAt,
            rank: item.rank,
            crawledAt,
          },
        })

        // 实时匹配关键词（如果启用）
        if (this.enableRealtimeMatching && this.matcherService && this.calculatorService) {
          try {
            // 获取要匹配的关键词组
            let keywordGroups = await this.matcherService.getEnabledKeywordGroups()
            
            // 如果指定了关键词组ID，只匹配这些组
            if (keywordGroupIds && keywordGroupIds.length > 0) {
              keywordGroups = keywordGroups.filter(g => keywordGroupIds.includes(g.id))
              console.log(`[Crawler] 实时匹配: 使用指定的 ${keywordGroupIds.length} 个关键词组`)
            } else {
              console.log(`[Crawler] 实时匹配: 使用所有启用的关键词组 (${keywordGroups.length}个)`)
            }

            if (keywordGroups.length === 0) {
              console.warn(`[Crawler] 实时匹配: 没有可用的关键词组，跳过匹配`)
            } else {
              // 匹配标题
              const matchResult = await this.matcherService.matchTitle(item.title, keywordGroups)
              
              console.log(`[Crawler] 实时匹配: 标题="${item.title.substring(0, 30)}..." 匹配结果:`, {
                matched: matchResult?.matched || false,
                keywordGroup: matchResult?.keywordGroup?.name || null,
                matchedWords: matchResult?.matchedWords || [],
              })
            
              if (matchResult && matchResult.matched && matchResult.keywordGroup) {
                // 获取新闻的出现记录
                const appearances = await this.prisma.newsAppearance.findMany({
                  where: { newsItemId: newsItem.id },
                })

                // 计算权重
                const appearanceData = appearances.map((a) => ({
                  rank: a.rank,
                  appearedAt: a.appearedAt,
                }))
                
                const weight = this.calculatorService.calculateWeight({
                  ranks: appearanceData.map((a) => a.rank).concat([newsItem.rank]),
                  matchCount: 1,
                  appearances: appearanceData.concat([
                    {
                      rank: newsItem.rank,
                      appearedAt: newsItem.crawledAt,
                    },
                  ]),
                })

                // 创建或更新匹配记录
                const matchRecord = await this.prisma.newsMatch.upsert({
                  where: {
                    newsItemId_keywordGroupId: {
                      newsItemId: newsItem.id,
                      keywordGroupId: matchResult.keywordGroup.id,
                    },
                  },
                  update: {
                    weight,
                    matchCount: { increment: 1 },
                    lastMatchedAt: new Date(),
                  },
                  create: {
                    newsItemId: newsItem.id,
                    keywordGroupId: matchResult.keywordGroup.id,
                    weight,
                    matchCount: 1,
                    firstMatchedAt: new Date(),
                    lastMatchedAt: new Date(),
                  },
                })

                // 创建出现记录
                await this.prisma.newsAppearance.create({
                  data: {
                    newsItemId: newsItem.id,
                    matchId: matchRecord.id,
                    rank: newsItem.rank,
                    appearedAt: newsItem.crawledAt,
                  },
                })
              }
            }
          } catch (matchError) {
            // 匹配失败不影响新闻保存
            console.error(`Error matching news item: ${item.title}`, matchError)
          }
        }
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

  private async getUserPlatformConfigs(
    platformIds: string[]
  ): Promise<Map<string, Prisma.JsonValue>> {
    if (!this.userId || platformIds.length === 0) {
      return new Map()
    }

    const configs = await this.prisma.platformConfig.findMany({
      where: {
        platformId: { in: platformIds },
        userId: this.userId,
      },
    })

    const map = new Map<string, Prisma.JsonValue>()
    configs.forEach((config) => {
      map.set(config.platformId, config.config)
    })
    return map
  }

  private resolveCrawler(
    platform: {
      platformId: string
      crawlerType: string
    },
    configOverride?: Prisma.JsonValue | null
  ) {
    const effectiveConfig = configOverride

    if (platform.crawlerType === 'configurable-html') {
      if (isHtmlConfig(effectiveConfig)) {
        return new ConfigurableHtmlCrawler(
          platform.platformId,
          effectiveConfig as ConfigurableHtmlCrawlerConfig
        )
      }
      console.warn(`[${platform.platformId}] 缺少 HTML 爬虫配置，无法实例化`)
      return null
    }

    if (isHtmlConfig(effectiveConfig)) {
      return new ConfigurableHtmlCrawler(
        platform.platformId,
        effectiveConfig as ConfigurableHtmlCrawlerConfig
      )
    }

    return getCrawler(platform.platformId)
  }
}

function mergeJsonConfig(
  base?: Prisma.JsonValue | null,
  override?: Prisma.JsonValue | null
): Prisma.JsonValue | null {
  if (override === undefined || override === null) {
    return base ?? null
  }
  if (base === undefined || base === null) {
    return override ?? null
  }

  if (typeof base === 'object' && typeof override === 'object' && !Array.isArray(base) && !Array.isArray(override)) {
    const result: Record<string, any> = { ...(base as Record<string, any>) }
    for (const key of Object.keys(override as Record<string, any>)) {
      result[key] = mergeJsonConfig(result[key], (override as Record<string, any>)[key])
    }
    return result
  }

  return override
}

function isHtmlConfig(config?: Prisma.JsonValue | null): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  return (config as Record<string, any>).type === 'html'
}

