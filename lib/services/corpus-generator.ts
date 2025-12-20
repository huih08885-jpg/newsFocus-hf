/**
 * 语料生成服务
 * 将爬虫结果转换为适合 AI 分析的语料
 */

import { PrismaClient } from '@prisma/client'

export interface CorpusGenerationOptions {
  keywordGroupId?: string
  siteGroupId?: string
  startDate?: Date
  endDate?: Date
  maxItems?: number
  includeMetadata?: boolean
}

export interface CorpusResult {
  corpus: string
  itemCount: number
  sourceInfo: {
    type: 'keyword' | 'site_group'
    id: string
    name: string
  }
}

export class CorpusGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * 从关键词爬虫结果生成语料
   */
  async generateFromKeywordGroup(
    keywordGroupId: string,
    options: Omit<CorpusGenerationOptions, 'keywordGroupId' | 'siteGroupId'> = {}
  ): Promise<CorpusResult> {
    const keywordGroup = await this.prisma.keywordGroup.findUnique({
      where: { id: keywordGroupId },
    })

    if (!keywordGroup) {
      throw new Error(`关键词组不存在: ${keywordGroupId}`)
    }

    const { startDate, endDate, maxItems = 100 } = options

    // 查询匹配的新闻
    const where: any = {
      keywordGroupId,
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = startDate
      }
      if (endDate) {
        where.createdAt.lte = endDate
      }
    }

    const matches = await this.prisma.newsMatch.findMany({
      where,
      include: {
        newsItem: {
          include: {
            platform: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: maxItems,
    })

    if (matches.length === 0) {
      throw new Error('没有找到匹配的新闻数据')
    }

    // 生成语料
    const corpus = this.buildCorpus(
      matches.map(m => ({
        title: m.newsItem.title,
        content: m.newsItem.content || '',
        url: m.newsItem.url || '',
        platform: m.newsItem.platform.name,
        publishedAt: m.newsItem.publishedAt,
        crawledAt: m.newsItem.crawledAt,
        weight: m.weight,
      })),
      options.includeMetadata
    )

    return {
      corpus,
      itemCount: matches.length,
      sourceInfo: {
        type: 'keyword',
        id: keywordGroupId,
        name: keywordGroup.name || '未命名关键词组',
      },
    }
  }

  /**
   * 从兴趣站点爬虫结果生成语料
   */
  async generateFromSiteGroup(
    siteGroupId: string,
    options: Omit<CorpusGenerationOptions, 'keywordGroupId' | 'siteGroupId'> = {}
  ): Promise<CorpusResult> {
    // 查询站点分组（需要先检查是否有这个表）
    // 这里假设有 site_groups 表
    const { startDate, endDate, maxItems = 100 } = options

    // 查询该分组下的站点
    const sites = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT id FROM site_candidates 
      WHERE group_id = $1::text
    `, siteGroupId)

    if (sites.length === 0) {
      throw new Error(`站点分组不存在或没有站点: ${siteGroupId}`)
    }

    const siteIds = sites.map(s => s.id)

    // 查询爬虫结果
    let whereClause = `scr.site_id = ANY($1::uuid[])`
    const params: any[] = [siteIds]

    if (startDate || endDate) {
      const conditions: string[] = []
      if (startDate) {
        params.push(startDate)
        conditions.push(`COALESCE(scr.published_at, scr.crawled_at) >= $${params.length}::timestamp`)
      }
      if (endDate) {
        params.push(endDate)
        conditions.push(`COALESCE(scr.published_at, scr.crawled_at) <= $${params.length}::timestamp`)
      }
      if (conditions.length > 0) {
        whereClause += ` AND ${conditions.join(' AND ')}`
      }
    }

    const results = await this.prisma.$queryRawUnsafe<Array<{
      title: string
      summary: string | null
      url: string
      published_at: Date | null
      crawled_at: Date
      site_name: string | null
    }>>(`
      SELECT 
        scr.title,
        scr.summary,
        scr.url,
        scr.published_at,
        scr.crawled_at,
        sc.name as site_name
      FROM site_crawl_results scr
      JOIN site_candidates sc ON scr.site_id = sc.id
      WHERE ${whereClause}
      ORDER BY COALESCE(scr.published_at, scr.crawled_at) DESC
      LIMIT $${params.length + 1}::int
    `, ...params, maxItems)

    if (results.length === 0) {
      throw new Error('没有找到爬虫结果数据')
    }

    // 生成语料
    const corpus = this.buildCorpus(
      results.map(r => ({
        title: r.title,
        content: r.summary || '',
        url: r.url,
        platform: r.site_name || '未知站点',
        publishedAt: r.published_at,
        crawledAt: r.crawled_at,
        weight: 1,
      })),
      options.includeMetadata
    )

    // 获取分组名称
    const groupName = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(`
      SELECT name FROM site_groups WHERE id = $1::text
    `, siteGroupId).then(r => r[0]?.name || '未命名分组')

    return {
      corpus,
      itemCount: results.length,
      sourceInfo: {
        type: 'site_group',
        id: siteGroupId,
        name: groupName,
      },
    }
  }

  /**
   * 构建语料文本
   */
  private buildCorpus(
    items: Array<{
      title: string
      content: string
      url: string
      platform: string
      publishedAt: Date | null
      crawledAt: Date
      weight: number
    }>,
    includeMetadata = false
  ): string {
    const lines: string[] = []

    items.forEach((item, index) => {
      lines.push(`\n--- 新闻 ${index + 1} ---`)
      
      if (includeMetadata) {
        lines.push(`来源: ${item.platform}`)
        if (item.publishedAt) {
          lines.push(`发布时间: ${item.publishedAt.toISOString()}`)
        }
        lines.push(`权重: ${item.weight.toFixed(2)}`)
      }

      lines.push(`标题: ${item.title}`)
      
      if (item.content && item.content.trim()) {
        // 清理内容，移除多余的空白
        const cleanContent = item.content
          .replace(/\s+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        
        if (cleanContent.length > 0) {
          lines.push(`内容: ${cleanContent}`)
        }
      }

      if (includeMetadata && item.url) {
        lines.push(`链接: ${item.url}`)
      }
    })

    return lines.join('\n')
  }

  /**
   * 生成语料（自动判断来源类型）
   */
  async generate(
    sourceType: 'keyword' | 'site_group',
    sourceId: string,
    options: Omit<CorpusGenerationOptions, 'keywordGroupId' | 'siteGroupId'> = {}
  ): Promise<CorpusResult> {
    if (sourceType === 'keyword') {
      return this.generateFromKeywordGroup(sourceId, options)
    } else {
      return this.generateFromSiteGroup(sourceId, options)
    }
  }
}

