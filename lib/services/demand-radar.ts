/**
 * 需求雷达服务
 * 自动抓取和分析欧美市场需求缺口
 */

import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { fetchHTML } from '@/lib/utils/fetch-helper'
import { HTMLParser } from '@/lib/utils/html-parser'
import { logger } from '@/lib/utils/logger'

export interface DemandRadarConfig {
  platforms?: string[] // 要抓取的平台列表
  hoursBack?: number // 抓取过去多少小时的数据，默认24
  maxResultsPerPlatform?: number // 每个平台最多抓取多少条，默认100
}

export interface ExtractedDemand {
  originalText: string
  cleanedText: string
  keywords: string[]
  category?: string
}

export class DemandRadarService {
  private prisma: PrismaClient

  // 需求提取模式
  private demandPatterns = [
    /I need a tool that (.+?)(?:\.|$|!|\?)/gi,
    /Does anyone know a tool for (.+?)(?:\.|$|!|\?)/gi,
    /I wish there was a tool (.+?)(?:\.|$|!|\?)/gi,
    /Looking for a tool to (.+?)(?:\.|$|!|\?)/gi,
    /Need a solution for (.+?)(?:\.|$|!|\?)/gi,
    /Is there a tool that (.+?)(?:\.|$|!|\?)/gi,
    /Can someone recommend a tool (.+?)(?:\.|$|!|\?)/gi,
    /有什么工具可以(.+?)(?:。|？|！|$)/gi, // 中文
    /有没有工具(.+?)(?:。|？|！|$)/gi, // 中文
  ]

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * 执行需求雷达任务
   */
  async runTask(config: DemandRadarConfig = {}): Promise<{
    taskId: string
    sourcesCount: number
    demandsCount: number
    rankingsCount: number
  }> {
    const {
      platforms = ['reddit', 'producthunt', 'hackernews', 'g2', 'toolify', 'twitter'],
      hoursBack = 24,
      maxResultsPerPlatform = 100,
    } = config

    // 创建任务记录
    const task = await this.prisma.demandRadarTask.create({
      data: {
        status: 'running',
        platforms,
        startedAt: new Date(),
      },
    })

    try {
      logger.info(`开始执行任务，平台: ${platforms.join(', ')}`, 'DemandRadar', { taskId: task.id, platforms, hoursBack, maxResultsPerPlatform })

      let totalSources = 0
      let totalDemands = 0
      const platformStats: Record<string, { sources: number; demands: number; success: boolean }> = {}

      // 抓取各平台数据
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i]
        const platformIndex = i + 1
        const platformTotal = platforms.length
        
        try {
          logger.info(`[${platformIndex}/${platformTotal}] 开始抓取平台: ${platform}`, 'DemandRadar', { 
            platform, 
            platformIndex, 
            platformTotal,
            hoursBack,
            maxResultsPerPlatform 
          })
          
          const crawlStartTime = Date.now()
          const sources = await this.crawlPlatform(platform, hoursBack, maxResultsPerPlatform)
          const crawlDuration = Date.now() - crawlStartTime
          
          logger.info(`平台 ${platform} 抓取完成，获取 ${sources.length} 条原始数据，耗时 ${crawlDuration}ms`, 'DemandRadar', { 
            platform, 
            sourcesCount: sources.length, 
            duration: crawlDuration 
          })
          
          if (sources.length === 0) {
            logger.warn(`平台 ${platform} 未获取到数据`, 'DemandRadar', { platform })
            platformStats[platform] = { sources: 0, demands: 0, success: true }
            continue
          }
          
          // 保存原始数据
          let platformSources = 0
          let platformDemands = 0
          
          logger.info(`开始保存平台 ${platform} 的数据到数据库`, 'DemandRadar', { 
            platform, 
            sourcesToSave: sources.length 
          })
          
          for (let j = 0; j < sources.length; j++) {
            const source = sources[j]
            const sourceIndex = j + 1
            
            try {
              const saved = await this.prisma.demandSource.create({
                data: {
                  platform,
                  sourceId: source.sourceId,
                  title: source.title,
                  content: source.content,
                  url: source.url,
                  author: source.author,
                  upvotes: source.upvotes,
                  comments: source.comments,
                  metadata: source.metadata,
                  crawledAt: source.crawledAt || new Date(),
                },
              })

              // 提取需求
              const demands = this.extractDemands(source.content)
              
              if (demands.length > 0) {
                logger.debug(`从数据源 ${sourceIndex}/${sources.length} 提取到 ${demands.length} 个需求`, 'DemandRadar', { 
                  platform, 
                  sourceIndex: sourceIndex,
                  sourceTotal: sources.length,
                  demandsCount: demands.length 
                })
              }
              
              for (const demand of demands) {
                await this.prisma.extractedDemand.create({
                  data: {
                    sourceId: saved.id,
                    originalText: demand.originalText,
                    cleanedText: demand.cleanedText,
                    keywords: demand.keywords,
                    category: demand.category,
                  },
                })
                totalDemands++
                platformDemands++
              }

              totalSources++
              platformSources++
              
              // 每10条记录一次进度
              if (sourceIndex % 10 === 0 || sourceIndex === sources.length) {
                logger.info(`平台 ${platform} 处理进度: ${sourceIndex}/${sources.length}，已提取 ${platformDemands} 个需求`, 'DemandRadar', { 
                  platform, 
                  processed: sourceIndex, 
                  total: sources.length,
                  demandsExtracted: platformDemands 
                })
              }
            } catch (sourceError) {
              logger.error(`保存数据源失败 (${sourceIndex}/${sources.length})`, 
                sourceError instanceof Error ? sourceError : new Error(String(sourceError)), 
                'DemandRadar', 
                { 
                  platform, 
                  sourceIndex,
                  sourceTitle: source.title?.substring(0, 50) 
                }
              )
              // 继续处理下一个数据源
            }
          }

          platformStats[platform] = { 
            sources: platformSources, 
            demands: platformDemands, 
            success: true 
          }
          
          logger.info(`平台 ${platform} 处理完成: ${platformSources} 条数据源, ${platformDemands} 个需求`, 'DemandRadar', { 
            platform, 
            sourcesCount: platformSources, 
            demandsCount: platformDemands 
          })
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          logger.error(`平台 ${platform} 抓取失败`, errorObj, 'DemandRadar', { 
            platform, 
            platformIndex, 
            platformTotal,
            error: errorObj.message 
          })
          platformStats[platform] = { sources: 0, demands: 0, success: false }
          // 继续处理其他平台
        }
      }
      
      // 汇总统计
      const successPlatforms = Object.values(platformStats).filter(s => s.success).length
      const failedPlatforms = platforms.length - successPlatforms
      
      logger.info(`所有平台抓取完成，成功: ${successPlatforms}，失败: ${failedPlatforms}`, 'DemandRadar', { 
        totalPlatforms: platforms.length,
        successPlatforms,
        failedPlatforms,
        totalSources,
        totalDemands,
        platformStats 
      })

      // 生成今日榜单
      logger.info('开始生成今日需求榜单', 'DemandRadar', { 
        totalSources, 
        totalDemands 
      })
      
      const rankingStartTime = Date.now()
      const rankingsCount = await this.generateDailyRankings(new Date())
      const rankingDuration = Date.now() - rankingStartTime
      
      logger.info(`榜单生成完成: ${rankingsCount} 个榜单项，耗时 ${rankingDuration}ms`, 'DemandRadar', { 
        rankingsCount, 
        duration: rankingDuration 
      })

      // 更新任务状态
      await this.prisma.demandRadarTask.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          sourcesCount: totalSources,
          demandsCount: totalDemands,
          rankingsCount,
          completedAt: new Date(),
        },
      })

      logger.info(`任务完成: ${totalSources} 条数据源, ${totalDemands} 个需求, ${rankingsCount} 个榜单项`, 'DemandRadar', {
        sourcesCount: totalSources,
        demandsCount: totalDemands,
        rankingsCount,
      })

      return {
        taskId: task.id,
        sourcesCount: totalSources,
        demandsCount: totalDemands,
        rankingsCount,
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error('任务执行失败', errorObj, 'DemandRadar', { taskId: task.id })
      
      await this.prisma.demandRadarTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: errorObj.message,
          completedAt: new Date(),
        },
      })
      throw error
    }
  }

  /**
   * 抓取指定平台的数据
   */
  private async crawlPlatform(
    platform: string,
    hoursBack: number,
    maxResults: number
  ): Promise<Array<{
    sourceId?: string
    title?: string
    content: string
    url?: string
    author?: string
    upvotes?: number
    comments?: number
    metadata?: any
    crawledAt?: Date
  }>> {
    switch (platform) {
      case 'reddit':
        return this.crawlReddit(hoursBack, maxResults)
      case 'producthunt':
        return this.crawlProductHunt(hoursBack, maxResults)
      case 'hackernews':
        return this.crawlHackerNews(hoursBack, maxResults)
      case 'g2':
        return this.crawlG2(hoursBack, maxResults)
      case 'toolify':
        return this.crawlToolify(hoursBack, maxResults)
      case 'twitter':
        return this.crawlTwitter(hoursBack, maxResults)
      default:
        logger.warn(`未知平台: ${platform}`, 'DemandRadar', { platform })
        return []
    }
  }

  /**
   * 抓取 Reddit
   */
  private async crawlReddit(hoursBack: number, maxResults: number): Promise<any[]> {
    const results: any[] = []
    // Reddit API 或 HTML 爬取
    // 这里使用简化的实现，实际应该使用 Reddit API
    try {
      // 示例：抓取 r/SaaS, r/entrepreneur, r/startups 等子版块
      const subreddits = ['SaaS', 'entrepreneur', 'startups', 'webdev', 'tools']
      
      for (const subreddit of subreddits.slice(0, 2)) { // 限制子版块数量
        try {
          const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })

          if (response.ok) {
            const data = await response.json()
            const posts = data.data?.children || []

            for (const post of posts) {
              const postData = post.data
              const postTime = new Date(postData.created_utc * 1000)
              const hoursAgo = (Date.now() - postTime.getTime()) / (1000 * 60 * 60)

              if (hoursAgo <= hoursBack) {
                // 获取评论
                const commentsUrl = `https://www.reddit.com/r/${subreddit}/comments/${postData.id}.json`
                let comments = ''
                try {
                  const commentsResponse = await fetch(commentsUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                  })
                  if (commentsResponse.ok) {
                    const commentsData = await commentsResponse.json()
                    // 提取评论内容（简化实现）
                    comments = JSON.stringify(commentsData).substring(0, 5000)
                  }
                } catch (e) {
                  // 忽略评论获取失败
                }

                results.push({
                  sourceId: postData.id,
                  title: postData.title,
                  content: `${postData.title}\n${postData.selftext || ''}\n${comments}`,
                  url: `https://www.reddit.com${postData.permalink}`,
                  author: postData.author,
                  upvotes: postData.ups || 0,
                  comments: postData.num_comments || 0,
                  crawledAt: postTime,
                })

                if (results.length >= maxResults) break
              }
            }
          }
        } catch (error) {
          console.error(`[DemandRadar] Reddit ${subreddit} 抓取失败:`, error)
        }
      }
    } catch (error) {
      console.error('[DemandRadar] Reddit 抓取失败:', error)
    }

    return results.slice(0, maxResults)
  }

  /**
   * 抓取 Product Hunt
   */
  private async crawlProductHunt(hoursBack: number, maxResults: number): Promise<any[]> {
    const results: any[] = []
    try {
      // Product Hunt 需要 API 或 HTML 解析
      // 这里使用简化的 HTML 解析
      const url = 'https://www.producthunt.com/'
      const html = await fetchHTML(url, {
        checkRobots: false,
        timeout: 15000,
      })

      if (html) {
        const $ = HTMLParser.parse(html)
        // 解析产品列表（需要根据实际HTML结构调整）
        $('[data-test="post-item"]').each((i, el) => {
          if (results.length >= maxResults) return false

          const title = HTMLParser.extractTextWithFallback($(el), ['h3'])
          const description = HTMLParser.extractTextWithFallback($(el), ['p'])
          const voteText = HTMLParser.extractTextWithFallback($(el), ['[data-test="vote-button"]'])
          const upvotes = parseInt(voteText) || 0
          const link = $(el).find('a').attr('href') || ''

          if (title && description) {
            results.push({
              title,
              content: `${title}\n${description}`,
              url: link.startsWith('http') ? link : `https://www.producthunt.com${link}`,
              upvotes,
              crawledAt: new Date(),
            })
          }
        })
      }
    } catch (error) {
      console.error('[DemandRadar] Product Hunt 抓取失败:', error)
    }

    return results
  }

  /**
   * 抓取 Hacker News
   */
  private async crawlHackerNews(hoursBack: number, maxResults: number): Promise<any[]> {
    const results: any[] = []
    logger.info('开始抓取 Hacker News', 'DemandRadar.HackerNews', { hoursBack, maxResults })
    
    try {
      // 使用 Hacker News API
      const topStoriesUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json'
      logger.debug('请求 Hacker News Top Stories', 'DemandRadar.HackerNews', { url: topStoriesUrl })
      
      const response = await fetch(topStoriesUrl)
      
      if (response.ok) {
        const storyIds: number[] = await response.json()
        logger.info(`Hacker News 获取到 ${storyIds.length} 个故事ID，将处理前50个`, 'DemandRadar.HackerNews', { 
          totalStories: storyIds.length,
          toProcess: Math.min(50, storyIds.length) 
        })
        
        let processed = 0
        let validStories = 0
        
        for (const storyId of storyIds.slice(0, 50)) {
          try {
            const storyUrl = `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
            const storyResponse = await fetch(storyUrl)
            
            if (storyResponse.ok) {
              const story: any = await storyResponse.json()
              const storyTime = new Date(story.time * 1000)
              const hoursAgo = (Date.now() - storyTime.getTime()) / (1000 * 60 * 60)

              if (hoursAgo <= hoursBack && story.type === 'story') {
                // 获取评论
                let comments = ''
                if (story.kids && story.kids.length > 0) {
                  const commentIds = story.kids.slice(0, 10) // 只取前10个评论
                  const commentTexts: string[] = []
                  
                  logger.debug(`获取故事 ${storyId} 的评论`, 'DemandRadar.HackerNews', { 
                    storyId, 
                    commentCount: commentIds.length 
                  })
                  
                  for (const commentId of commentIds) {
                    try {
                      const commentUrl = `https://hacker-news.firebaseio.com/v0/item/${commentId}.json`
                      const commentResponse = await fetch(commentUrl)
                      if (commentResponse.ok) {
                        const comment: any = await commentResponse.json()
                        if (comment.text) {
                          commentTexts.push(comment.text)
                        }
                      }
                    } catch (e) {
                      // 忽略单个评论获取失败
                    }
                  }
                  comments = commentTexts.join('\n')
                }

                results.push({
                  sourceId: String(story.id),
                  title: story.title,
                  content: `${story.title}\n${story.text || ''}\n${comments}`,
                  url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
                  author: story.by,
                  upvotes: story.score || 0,
                  comments: story.descendants || 0,
                  crawledAt: storyTime,
                })
                validStories++

                if (results.length >= maxResults) {
                  logger.info(`已达到最大结果数 ${maxResults}，停止抓取`, 'DemandRadar.HackerNews', { 
                    resultsCount: results.length 
                  })
                  break
                }
              }
              processed++
            }
          } catch (e) {
            logger.debug(`获取故事 ${storyId} 失败`, 'DemandRadar.HackerNews', { storyId })
            // 忽略单个故事获取失败
          }
        }
        
        logger.info(`Hacker News 抓取完成: 处理 ${processed} 个故事，有效 ${validStories} 个，获取 ${results.length} 条数据`, 'DemandRadar.HackerNews', { 
          processed,
          validStories,
          resultsCount: results.length 
        })
      } else {
        logger.warn(`Hacker News API 请求失败: HTTP ${response.status}`, 'DemandRadar.HackerNews', { status: response.status })
      }
    } catch (error) {
      logger.error('Hacker News 抓取失败', error instanceof Error ? error : new Error(String(error)), 'DemandRadar.HackerNews')
    }

    return results
  }

  /**
   * 抓取 G2（差评）
   */
  private async crawlG2(hoursBack: number, maxResults: number): Promise<any[]> {
    // G2 需要登录或API，这里返回空数组
    // 实际实现需要使用 G2 API 或爬取差评页面
    logger.warn('G2 爬取未实现，需要 API 或特殊处理', 'DemandRadar.G2', { hoursBack, maxResults })
    return []
  }

  /**
   * 抓取 Toolify
   */
  private async crawlToolify(hoursBack: number, maxResults: number): Promise<any[]> {
    // Toolify 需要根据实际网站结构实现
    logger.warn('Toolify 爬取未实现', 'DemandRadar.Toolify', { hoursBack, maxResults })
    return []
  }

  /**
   * 抓取 Twitter/X
   */
  private async crawlTwitter(hoursBack: number, maxResults: number): Promise<any[]> {
    // Twitter 需要 API，这里返回空数组
    // 实际实现需要使用 Twitter API v2
    logger.warn('Twitter 爬取未实现，需要 API', 'DemandRadar.Twitter', { hoursBack, maxResults })
    return []
  }

  /**
   * 从文本中提取需求
   */
  private extractDemands(text: string): ExtractedDemand[] {
    const demands: ExtractedDemand[] = []
    const found = new Set<string>()
    const textLength = text.length

    // 使用正则表达式匹配需求模式
    let totalMatches = 0
    for (const pattern of this.demandPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        totalMatches++
        const originalText = match[0].trim()
        const demandText = match[1]?.trim() || originalText

        // 去重
        const key = demandText.toLowerCase()
        if (found.has(key)) {
          logger.debug('跳过重复需求', 'DemandRadar.Extractor', { demandText: demandText.substring(0, 50) })
          continue
        }
        found.add(key)

        // 清洗文本
        const cleanedText = this.cleanText(demandText)

        // 提取关键词
        const keywords = this.extractKeywords(cleanedText)

        // 分类
        const category = this.categorizeDemand(keywords)

        demands.push({
          originalText,
          cleanedText,
          keywords,
          category,
        })
        
        logger.debug('提取到需求', 'DemandRadar.Extractor', { 
          demandText: cleanedText.substring(0, 100),
          keywords: keywords.slice(0, 5),
          category 
        })
      }
    }

    if (totalMatches > 0 || demands.length > 0) {
      logger.debug(`需求提取完成: 匹配 ${totalMatches} 次，去重后 ${demands.length} 个`, 'DemandRadar.Extractor', { 
        textLength,
        totalMatches, 
        uniqueDemands: demands.length 
      })
    }

    return demands
  }

  /**
   * 清洗文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/[^\w\s]/g, ' ') // 移除特殊字符
      .replace(/\s+/g, ' ') // 合并空格
      .trim()
      .toLowerCase()
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取（可以改进为使用 NLP 库）
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'to', 'for', 'of', 'in', 'on',
      'at', 'by', 'with', 'from', 'as', 'that', 'this', 'it', 'i', 'you', 'he',
      'she', 'we', 'they', 'what', 'which', 'who', 'where', 'when', 'why', 'how',
    ])

    return text
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10) // 最多10个关键词
  }

  /**
   * 分类需求
   */
  private categorizeDemand(keywords: string[]): string | undefined {
    const categories: Record<string, string[]> = {
      email: ['email', 'mail', 'newsletter', 'smtp'],
      seo: ['seo', 'search', 'ranking', 'keyword'],
      automation: ['automate', 'automation', 'workflow', 'scheduler'],
      analytics: ['analytics', 'tracking', 'metrics', 'data'],
      social: ['social', 'twitter', 'facebook', 'instagram', 'linkedin'],
      ecommerce: ['shop', 'store', 'cart', 'payment', 'checkout'],
      design: ['design', 'ui', 'ux', 'mockup', 'prototype'],
      development: ['code', 'api', 'deploy', 'server', 'backend'],
    }

    for (const [category, terms] of Object.entries(categories)) {
      if (keywords.some(kw => terms.some(term => kw.includes(term) || term.includes(kw)))) {
        return category
      }
    }

    return undefined
  }

  /**
   * 生成每日榜单
   */
  async generateDailyRankings(date: Date = new Date()): Promise<number> {
    // 获取过去24小时的需求
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    logger.info('开始生成每日榜单', 'DemandRadar.Ranking', { 
      date: date.toISOString().split('T')[0],
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString() 
    })

    // 获取所有需求，按清洗后的文本分组统计频次
    logger.debug('查询当日需求数据', 'DemandRadar.Ranking')
    const demands = await this.prisma.extractedDemand.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        source: true,
      },
    })

    logger.info(`查询到 ${demands.length} 个需求记录`, 'DemandRadar.Ranking', { demandsCount: demands.length })

    if (demands.length === 0) {
      logger.warn('当日无需求数据，无法生成榜单', 'DemandRadar.Ranking')
      return 0
    }

    // 按清洗后的文本分组
    logger.debug('开始按文本分组统计频次', 'DemandRadar.Ranking')
    const demandGroups = new Map<string, {
      demand: typeof demands[0]
      frequency: number
      sources: Set<string>
    }>()

    for (const demand of demands) {
      const key = demand.cleanedText.toLowerCase()
      if (!demandGroups.has(key)) {
        demandGroups.set(key, {
          demand,
          frequency: 0,
          sources: new Set(),
        })
      }
      const group = demandGroups.get(key)!
      group.frequency++
      if (demand.sourceId) {
        group.sources.add(demand.sourceId)
      }
    }

    logger.info(`分组完成，共 ${demandGroups.size} 个唯一需求`, 'DemandRadar.Ranking', { 
      uniqueDemands: demandGroups.size,
      totalDemands: demands.length 
    })

    // 转换为数组并排序
    const sortedDemands = Array.from(demandGroups.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20) // 取前20个

    logger.info(`排序完成，Top 20 需求频次范围: ${sortedDemands[sortedDemands.length - 1]?.frequency || 0} - ${sortedDemands[0]?.frequency || 0}`, 'DemandRadar.Ranking', { 
      top20Count: sortedDemands.length,
      maxFrequency: sortedDemands[0]?.frequency || 0,
      minFrequency: sortedDemands[sortedDemands.length - 1]?.frequency || 0 
    })

    // 删除当天的旧榜单
    logger.debug('删除当日旧榜单', 'DemandRadar.Ranking')
    const deletedCount = await this.prisma.demandRanking.deleteMany({
      where: {
        rankingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
    
    if (deletedCount.count > 0) {
      logger.info(`已删除 ${deletedCount.count} 条旧榜单记录`, 'DemandRadar.Ranking', { deletedCount: deletedCount.count })
    }

    // 创建新榜单
    logger.debug('开始创建新榜单记录', 'DemandRadar.Ranking', { rankingsToCreate: sortedDemands.length })
    const rankings = []
    
    for (let i = 0; i < sortedDemands.length; i++) {
      const item = sortedDemands[i]
      const demand = item.demand

      // 计算趋势（简化实现）
      const yesterday = new Date(date)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStart = new Date(yesterday)
      yesterdayStart.setHours(0, 0, 0, 0)
      const yesterdayEnd = new Date(yesterday)
      yesterdayEnd.setHours(23, 59, 59, 999)
      
      const yesterdayRanking = await this.prisma.demandRanking.findFirst({
        where: {
          demandId: demand.id,
          rankingDate: {
            gte: yesterdayStart,
            lte: yesterdayEnd,
          },
        },
      })

      let trend: string | undefined
      if (!yesterdayRanking) {
        trend = 'new'
      } else if (item.frequency > (yesterdayRanking.frequency || 0)) {
        trend = 'up'
      } else if (item.frequency < (yesterdayRanking.frequency || 0)) {
        trend = 'down'
      } else {
        trend = 'stable'
      }

      // 生成备注
      const notes = this.generateNotes(demand, item.frequency, item.sources.size)

      rankings.push({
        demandId: demand.id,
        rankingDate: startDate,
        rank: i + 1,
        frequency: item.frequency,
        trend,
        notes,
      })
    }

    // 批量创建
    if (rankings.length > 0) {
      await this.prisma.demandRanking.createMany({
        data: rankings,
      })
      
      logger.info(`榜单创建完成: ${rankings.length} 个榜单项`, 'DemandRadar.Ranking', { 
        rankingsCount: rankings.length,
        trends: {
          new: rankings.filter(r => r.trend === 'new').length,
          up: rankings.filter(r => r.trend === 'up').length,
          down: rankings.filter(r => r.trend === 'down').length,
          stable: rankings.filter(r => r.trend === 'stable').length,
        }
      })
    } else {
      logger.warn('没有可创建的榜单记录', 'DemandRadar.Ranking')
    }

    return rankings.length
  }

  /**
   * 生成备注
   */
  private generateNotes(demand: any, frequency: number, sourceCount: number): string {
    const notes: string[] = []

    if (frequency > 30) {
      notes.push('需求强烈')
    } else if (frequency > 20) {
      notes.push('需求较强')
    }

    if (demand.category) {
      notes.push(`${demand.category} 场景`)
    }

    if (sourceCount > 5) {
      notes.push('多平台讨论')
    }

    return notes.join('，') || undefined
  }

  /**
   * 获取今日榜单
   */
  async getTodayRankings(): Promise<any[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return await this.prisma.demandRanking.findMany({
      where: {
        rankingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        demand: {
          include: {
            source: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
    })
  }
}

