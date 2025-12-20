/**
 * 兴趣站点爬虫服务
 * 管理站点、分组、爬虫任务和结果
 */

import type { PrismaClient } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { deepSeekAI } from './deepseek-ai'
import { fetchHTML } from '@/lib/utils/fetch-helper'
import { ConfigurableHtmlCrawler } from './crawlers/configurable-html'
import type { ConfigurableHtmlCrawlerConfig } from './crawlers/configurable-html'

export interface SiteGroupInput {
  name: string
  description?: string
  color?: string
  order?: number
}

export interface SiteUpdateInput {
  name?: string
  groupId?: string | null
  crawlEnabled?: boolean
}

export interface CrawlTaskInput {
  siteIds: string[]
  type: 'today' | 'range'
  startDate?: Date
  endDate?: Date
}

export class InterestSiteCrawlerService {
  constructor(private prismaClient: PrismaClient = prisma) {}

  // ==================== 站点分组管理 ====================

  async getGroups() {
    return this.prismaClient.$queryRaw`
      SELECT * FROM site_groups
      ORDER BY "order" ASC, created_at DESC
    ` as Promise<any[]>
  }

  async createGroup(input: SiteGroupInput) {
    return this.prismaClient.$queryRaw`
      INSERT INTO site_groups (name, description, color, "order")
      VALUES (${input.name}, ${input.description || null}, ${input.color || null}, ${input.order || 0})
      RETURNING *
    ` as Promise<any>
  }

  async updateGroup(id: string, input: Partial<SiteGroupInput>) {
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(input.name)
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(input.description)
    }
    if (input.color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      values.push(input.color)
    }
    if (input.order !== undefined) {
      updates.push(`"order" = $${paramIndex++}`)
      values.push(input.order)
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const query = `
      UPDATE site_groups
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    return this.prismaClient.$queryRawUnsafe(query, ...values) as Promise<any>
  }

  async deleteGroup(id: string) {
    // 先清除关联的站点分组
    await this.prismaClient.$executeRawUnsafe(`
      UPDATE site_candidates SET group_id = NULL WHERE group_id = $1
    `, id)
    
    return this.prismaClient.$executeRawUnsafe(`
      DELETE FROM site_groups WHERE id = $1
    `, id)
  }

  // ==================== 站点管理 ====================

  async getSites(filters?: { groupId?: string; status?: string; analysisStatus?: string }) {
    // 使用 Prisma 的 tagged template 来安全地构建查询
    let query = `
      SELECT 
        sc.id,
        sc.domain,
        sc.status,
        sc.keyword_group_id,
        sc.last_discovered_at,
        sc.config_json,
        sc.stats_json,
        sc.created_at,
        sc.updated_at,
        COALESCE(sc.name, (sc.stats_json->>'title')::text, sc.domain) as name,
        sc.group_id,
        COALESCE(sc.analysis_status, 'pending') as analysis_status,
        sc.analysis_result,
        sc.analysis_error,
        sc.last_analyzed_at,
        sc.last_crawled_at,
        COALESCE(sc.crawl_enabled, true) as crawl_enabled,
        sc.config_json,
        sg.name as group_name,
        sg.color as group_color,
        COALESCE((
          SELECT COUNT(*)::integer 
          FROM site_crawl_results 
          WHERE site_id = sc.id
        ), 0) as result_count,
        (
          SELECT MAX(crawled_at) 
          FROM site_crawl_results 
          WHERE site_id = sc.id
        ) as last_result_time
      FROM site_candidates sc
      LEFT JOIN site_groups sg ON sc.group_id = sg.id
      WHERE 1=1
    `
    
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (filters?.groupId) {
      conditions.push(`sc.group_id = $${paramIndex++}`)
      values.push(filters.groupId)
    }
    if (filters?.status) {
      conditions.push(`sc.status = $${paramIndex++}`)
      values.push(filters.status)
    }
    if (filters?.analysisStatus) {
      conditions.push(`COALESCE(sc.analysis_status, 'pending') = $${paramIndex++}`)
      values.push(filters.analysisStatus)
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ')
    }

    query += ` ORDER BY sc.created_at DESC`

    console.log('[InterestSiteCrawler] Query:', query)
    console.log('[InterestSiteCrawler] Params:', values)

    const results = await this.prismaClient.$queryRawUnsafe(query, ...values) as any[]
    
    console.log('[InterestSiteCrawler] Query results:', results.length, 'sites found')
    
    return results.map((row: any) => ({
      id: row.id,
      domain: row.domain,
      name: row.name || row.domain,
      status: row.status || 'new',
      analysis_status: row.analysis_status || 'pending',
      analysis_error: row.analysis_error || null,
      last_crawled_at: row.last_crawled_at ? new Date(row.last_crawled_at).toISOString() : null,
      group_id: row.group_id || null,
      group_name: row.group_name || null,
      group_color: row.group_color || null,
      result_count: parseInt(row.result_count || '0', 10),
      last_result_time: row.last_result_time ? new Date(row.last_result_time).toISOString() : null,
      statsJson: row.stats_json,
      stats_json: row.stats_json, // 保留兼容性
      configJson: row.config_json, // 添加 camelCase 版本
      config_json: row.config_json, // 保留 snake_case 版本
      crawlEnabled: row.crawl_enabled !== false, // 默认为 true
    }))
  }

  async getSite(id: string) {
    // 使用 raw SQL 查询，但需要正确处理 UUID 类型
    const sites = await this.prismaClient.$queryRawUnsafe(`
      SELECT 
        sc.id,
        sc.domain,
        sc.status,
        sc.keyword_group_id,
        sc.last_discovered_at,
        sc.config_json,
        sc.stats_json,
        sc.created_at,
        sc.updated_at,
        COALESCE(sc.name, (sc.stats_json->>'title')::text, sc.domain) as name,
        sc.group_id,
        COALESCE(sc.analysis_status, 'pending') as analysis_status,
        sc.analysis_result,
        sc.analysis_error,
        sc.last_analyzed_at,
        sc.last_crawled_at,
        COALESCE(sc.crawl_enabled, true) as crawl_enabled,
        sg.name as group_name,
        sg.color as group_color
      FROM site_candidates sc
      LEFT JOIN site_groups sg ON sc.group_id = sg.id
      WHERE sc.id = $1::uuid
    `, id) as any[]

    if (sites.length === 0) {
      return null
    }

    const row = sites[0]
    return {
      id: row.id,
      domain: row.domain,
      name: row.name || row.domain,
      status: row.status || 'new',
      analysis_status: row.analysis_status || 'pending',
      analysis_error: row.analysis_error || null,
      last_crawled_at: row.last_crawled_at ? new Date(row.last_crawled_at).toISOString() : null,
      group_id: row.group_id || null,
      group_name: row.group_name || null,
      group_color: row.group_color || null,
      statsJson: row.stats_json,
      configJson: row.config_json, // 使用 camelCase 以匹配 executeCrawlTask 中的使用
      config_json: row.config_json, // 保留 snake_case 以保持兼容性
      crawlEnabled: row.crawl_enabled !== false, // 默认为 true
    }
  }

  async updateSite(id: string, input: SiteUpdateInput) {
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(input.name)
    }
    if (input.groupId !== undefined) {
      updates.push(`group_id = $${paramIndex++}`)
      values.push(input.groupId)
    }
    if (input.crawlEnabled !== undefined) {
      updates.push(`crawl_enabled = $${paramIndex++}`)
      values.push(input.crawlEnabled)
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const query = `
      UPDATE site_candidates
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await this.prismaClient.$queryRawUnsafe(query, ...values) as any[]
    return result[0] || null
  }

  async deleteSite(id: string) {
    return this.prismaClient.siteCandidate.delete({
      where: { id },
    })
  }

  // ==================== HTML 结构分析 ====================

  async analyzeSite(id: string): Promise<{ success: boolean; config?: any; error?: string }> {
    const site = await this.getSite(id)
    if (!site) {
      return { success: false, error: 'Site not found' }
    }

    // 获取站点URL
    const stats = site.statsJson as any
    const url = stats?.url || `https://${site.domain}`

    try {
      // 更新状态为分析中
      await this.prismaClient.$executeRawUnsafe(`
        UPDATE site_candidates 
        SET analysis_status = 'analyzing', last_analyzed_at = NOW()
        WHERE id = $1::uuid
      `, id)

      // 获取 HTML
      const html = await fetchHTML(url, {
        timeout: 15000,
        proxyFallback: true,
      })

      // 调用 DeepSeek 分析
      const analysisResult = await deepSeekAI.analyzeHtmlStructure({ url, html })

      if (analysisResult.success && analysisResult.config) {
        // 确保配置格式正确（添加 type 和 baseUrl）
        const normalizedConfig = {
          type: 'html',
          baseUrl: url.startsWith('http') ? new URL(url).origin : `https://${site.domain}`,
          ...analysisResult.config,
        }
        
        // 保存分析结果
        await this.prismaClient.$executeRawUnsafe(`
          UPDATE site_candidates 
          SET 
            analysis_status = 'success',
            analysis_result = $2::jsonb,
            analysis_error = NULL,
            config_json = $2::jsonb,
            last_analyzed_at = NOW()
          WHERE id = $1::uuid
        `, id, JSON.stringify(normalizedConfig))

        return {
          success: true,
          config: analysisResult.config,
        }
      } else {
        // 保存错误信息
        await this.prismaClient.$executeRawUnsafe(`
          UPDATE site_candidates 
          SET 
            analysis_status = 'failed',
            analysis_error = $2,
            last_analyzed_at = NOW()
          WHERE id = $1::uuid
        `, id, analysisResult.error || 'Unknown error')

        return {
          success: false,
          error: analysisResult.error || 'Analysis failed',
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await this.prismaClient.$executeRawUnsafe(`
        UPDATE site_candidates 
        SET 
          analysis_status = 'failed',
          analysis_error = $2,
          last_analyzed_at = NOW()
        WHERE id = $1::uuid
      `, id, errorMessage)

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  // ==================== 爬虫执行 ====================

  async createCrawlTask(input: CrawlTaskInput) {
    console.log(`[InterestSiteCrawler] ========== createCrawlTask START ==========`)
    console.log(`[InterestSiteCrawler] Input:`, JSON.stringify(input, null, 2))
    const tasks = []

    for (const siteId of input.siteIds) {
      console.log(`[InterestSiteCrawler] Processing site: ${siteId}`)
      const site = await this.getSite(siteId)
      if (!site) {
        console.warn(`[InterestSiteCrawler] Site ${siteId} not found`)
        continue
      }

      console.log(`[InterestSiteCrawler] Site found:`, {
        id: site.id,
        domain: site.domain,
        analysis_status: site.analysis_status,
        has_config: !!site.config_json,
        crawlEnabled: (site as any).crawlEnabled,
      })

      // 检查站点是否已分析并生成配置
      if (site.analysis_status !== 'success' || !site.config_json) {
        console.warn(`[InterestSiteCrawler] Site ${siteId} not ready: analysis_status=${site.analysis_status}, has_config=${!!site.config_json}`)
        continue
      }

      // crawlEnabled 默认为 true，如果明确设置为 false 才跳过
      const crawlEnabled = (site as any).crawlEnabled !== false
      if (!crawlEnabled) {
        console.warn(`[InterestSiteCrawler] Site ${siteId} crawler is disabled`)
        continue
      }

      console.log(`[InterestSiteCrawler] Creating task for site ${siteId}...`)
      const task = await this.prismaClient.$queryRawUnsafe(`
        INSERT INTO site_crawl_tasks (
          site_id, type, start_date, end_date, status
        ) VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          'pending'
        )
        RETURNING *
      `, siteId, input.type, input.startDate || null, input.endDate || null) as any

      console.log(`[InterestSiteCrawler] Task created:`, task[0])
      tasks.push(task[0])
    }

    if (tasks.length === 0) {
      console.error(`[InterestSiteCrawler] No tasks created!`)
      throw new Error('无法创建任务：站点未启用爬虫或配置不存在，请先分析站点')
    }

    // 异步执行爬虫任务
    const taskIds = tasks.map(t => t.id)
    console.log(`[InterestSiteCrawler] Created ${taskIds.length} crawl tasks:`, taskIds)
    console.log(`[InterestSiteCrawler] Starting async execution...`)
    this.executeCrawlTasks(taskIds).catch(error => {
      console.error(`[InterestSiteCrawler] ========== ERROR executing crawl tasks ==========`)
      console.error(`[InterestSiteCrawler] Error:`, error)
      console.error(`[InterestSiteCrawler] Error stack:`, error?.stack)
    })
    console.log(`[InterestSiteCrawler] ========== createCrawlTask END ==========`)

    return tasks
  }

  private async executeCrawlTasks(taskIds: string[]) {
    console.log(`[InterestSiteCrawler] ========== executeCrawlTasks START ==========`)
    console.log(`[InterestSiteCrawler] Task IDs:`, taskIds)
    console.log(`[InterestSiteCrawler] Starting execution of ${taskIds.length} crawl tasks`)
    
    for (const taskId of taskIds) {
      try {
        console.log(`[InterestSiteCrawler] ========== Executing task ${taskId} ==========`)
        await this.executeCrawlTask(taskId)
        console.log(`[InterestSiteCrawler] ✓ Completed crawl task: ${taskId}`)
      } catch (error) {
        console.error(`[InterestSiteCrawler] ✗ Failed to execute task ${taskId}:`, error)
        console.error(`[InterestSiteCrawler] Error details:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }
    console.log(`[InterestSiteCrawler] ========== executeCrawlTasks END ==========`)
  }

  private async executeCrawlTask(taskId: string) {
    console.log(`[InterestSiteCrawler] ========== executeCrawlTask START: ${taskId} ==========`)
    
    // 获取任务信息
    console.log(`[InterestSiteCrawler] Step 1: Fetching task info...`)
    const tasks = await this.prismaClient.$queryRawUnsafe(`
      SELECT * FROM site_crawl_tasks WHERE id = $1
    `, taskId) as any[]

    const task = tasks[0]
    if (!task) {
      throw new Error('Task not found')
    }
    console.log(`[InterestSiteCrawler] Task info:`, task)

    // 更新状态为运行中
    console.log(`[InterestSiteCrawler] Step 2: Updating task status to 'running'...`)
    await this.prismaClient.$executeRawUnsafe(`
      UPDATE site_crawl_tasks 
      SET status = 'running', started_at = NOW()
      WHERE id = $1
    `, taskId)

    try {
      // 获取站点配置
      console.log(`[InterestSiteCrawler] Step 3: Getting site config for site_id: ${task.site_id}`)
      const site = await this.getSite(task.site_id)
      if (!site) {
        throw new Error('Site not found')
      }
      console.log(`[InterestSiteCrawler] Site found:`, {
        id: site.id,
        domain: site.domain,
        analysis_status: site.analysis_status,
        has_config: !!site.configJson,
      })
      
      if (!site.configJson) {
        console.error(`[InterestSiteCrawler] Site ${task.site_id} has no config_json. Site analysis_status: ${site.analysis_status}`)
        throw new Error('Site config not found. Please analyze the site first.')
      }

      console.log(`[InterestSiteCrawler] Step 4: Parsing config...`)
      // 确保使用正确的字段名
      const rawConfig = site.configJson || site.config_json
      if (!rawConfig) {
        throw new Error('Site config_json is null or undefined')
      }
      
      // 确保配置格式正确
      let config = rawConfig as any
      
      // 如果配置缺少 type 字段，添加它
      if (!config.type) {
        config = {
          type: 'html',
          ...config,
        }
      }
      
      // 如果配置缺少 baseUrl，从站点 domain 生成
      if (!config.baseUrl && site.domain) {
        const stats = site.statsJson as any
        const url = stats?.url || `https://${site.domain}`
        try {
          const urlObj = new URL(url)
          config.baseUrl = `${urlObj.protocol}//${urlObj.host}`
        } catch {
          config.baseUrl = `https://${site.domain}`
        }
      }
      
      console.log(`[InterestSiteCrawler] Config type:`, config.type)
      console.log(`[InterestSiteCrawler] Config baseUrl:`, config.baseUrl)
      console.log(`[InterestSiteCrawler] Config list URL:`, config.list?.url)
      console.log(`[InterestSiteCrawler] Config itemSelector:`, config.list?.itemSelector)
      console.log(`[InterestSiteCrawler] Full config:`, JSON.stringify(config, null, 2))
      
      // 验证配置必需字段
      if (!config.list) {
        throw new Error('Config missing list configuration')
      }
      if (!config.list.itemSelector) {
        throw new Error('Config missing list.itemSelector')
      }
      if (!config.list.fields?.title) {
        throw new Error('Config missing list.fields.title')
      }
      
      // ConfigurableHtmlCrawler 需要 platformId 和 config
      console.log(`[InterestSiteCrawler] Step 5: Creating crawler instance...`)
      const crawler = new ConfigurableHtmlCrawler(site.domain, config as ConfigurableHtmlCrawlerConfig)

      // 执行爬虫
      console.log(`[InterestSiteCrawler] Step 6: Starting crawl...`)
      const result = await crawler.crawlWithOptions({
        keywords: [],
        limit: 100,
      })
      console.log(`[InterestSiteCrawler] Step 7: Crawl completed. Success: ${result.success}, Items: ${result.data?.length || 0}`)
      if (!result.success) {
        console.error(`[InterestSiteCrawler] Crawl failed:`, result.error)
        console.error(`[InterestSiteCrawler] This usually means no items were found or all items were filtered out`)
      }
      if (result.data && result.data.length > 0) {
        console.log(`[InterestSiteCrawler] First item sample:`, result.data[0])
      } else {
        console.warn(`[InterestSiteCrawler] No items returned from crawler. This could mean:`)
        console.warn(`[InterestSiteCrawler] 1. Selector didn't match any elements`)
        console.warn(`[InterestSiteCrawler] 2. All items were filtered out by content validation`)
        console.warn(`[InterestSiteCrawler] 3. URL is not accessible`)
      }

      // 即使 result.success 为 false，如果有数据也保存
      if (result.data && result.data.length > 0) {
        // 保存结果
        console.log(`[InterestSiteCrawler] Step 8: Saving ${result.data.length} crawl results...`)
        let resultCount = 0
        let errorCount = 0
        for (const item of result.data) {
          try {
            await this.prismaClient.$queryRawUnsafe(`
              INSERT INTO site_crawl_results (
                task_id, site_id, title, url, summary, published_at, crawled_at
              ) VALUES (
                $1,
                $2::uuid,
                $3,
                $4,
                $5,
                $6,
                NOW()
              )
            `, taskId, task.site_id, item.title || '', item.url || '', item.content || null, item.publishedAt || null)
            resultCount++
          } catch (error) {
            errorCount++
            console.error(`[InterestSiteCrawler] Failed to save result item ${resultCount + errorCount}:`, error)
            console.error(`[InterestSiteCrawler] Item data:`, item)
          }
        }
        console.log(`[InterestSiteCrawler] Step 9: Saved ${resultCount} results, ${errorCount} errors`)

        // 更新任务状态
        console.log(`[InterestSiteCrawler] Step 10: Updating task status to 'completed'...`)
        await this.prismaClient.$executeRawUnsafe(`
          UPDATE site_crawl_tasks 
          SET 
            status = 'completed',
            result_count = $2,
            completed_at = NOW()
          WHERE id = $1
        `, taskId, resultCount)

        // 更新站点最后爬取时间
        console.log(`[InterestSiteCrawler] Step 11: Updating site last_crawled_at...`)
        await this.prismaClient.$executeRawUnsafe(`
          UPDATE site_candidates 
          SET last_crawled_at = NOW()
          WHERE id = $1::uuid
        `, task.site_id)
        
        console.log(`[InterestSiteCrawler] ========== executeCrawlTask SUCCESS: ${taskId} ==========`)
      } else {
        throw new Error(result.error || 'Crawl failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[InterestSiteCrawler] ========== executeCrawlTask ERROR: ${taskId} ==========`)
      console.error(`[InterestSiteCrawler] Error message:`, errorMessage)
      console.error(`[InterestSiteCrawler] Error stack:`, error instanceof Error ? error.stack : undefined)
      console.error(`[InterestSiteCrawler] Full error:`, error)
      
      await this.prismaClient.$executeRawUnsafe(`
        UPDATE site_crawl_tasks 
        SET 
          status = 'failed',
          error_message = $2,
          completed_at = NOW()
        WHERE id = $1
      `, taskId, errorMessage)

      throw error
    }
  }

  // ==================== 爬虫结果查询 ====================

  async getCrawlResults(filters?: {
    siteId?: string
    groupId?: string
    taskId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    pageSize?: number
  }) {
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = `
      SELECT 
        scr.*,
        sc.domain,
        sc.name as site_name,
        sg.name as group_name,
        sg.color as group_color
      FROM site_crawl_results scr
      JOIN site_candidates sc ON scr.site_id = sc.id
      LEFT JOIN site_groups sg ON sc.group_id = sg.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (filters?.siteId) {
      query += ` AND scr.site_id = $${paramIndex++}`
      params.push(filters.siteId)
    }
    if (filters?.groupId) {
      query += ` AND sc.group_id = $${paramIndex++}`
      params.push(filters.groupId)
    }
    if (filters?.taskId) {
      query += ` AND scr.task_id = $${paramIndex++}`
      params.push(filters.taskId)
    }
    if (filters?.startDate) {
      query += ` AND scr.crawled_at >= $${paramIndex++}`
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += ` AND scr.crawled_at <= $${paramIndex++}`
      params.push(filters.endDate)
    }

    // 按发布时间倒序排列，如果没有发布时间则按爬取时间倒序
    query += ` ORDER BY COALESCE(scr.published_at, scr.crawled_at) DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(pageSize, offset)

    const results = await this.prismaClient.$queryRawUnsafe(query, ...params) as any[]

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM site_crawl_results scr
      JOIN site_candidates sc ON scr.site_id = sc.id
      LEFT JOIN site_groups sg ON sc.group_id = sg.id
      WHERE 1=1
    `
    const countParams: any[] = []
    let countParamIndex = 1

    if (filters?.siteId) {
      countQuery += ` AND scr.site_id = $${countParamIndex++}`
      countParams.push(filters.siteId)
    }
    if (filters?.groupId) {
      countQuery += ` AND sc.group_id = $${countParamIndex++}`
      countParams.push(filters.groupId)
    }
    if (filters?.taskId) {
      countQuery += ` AND scr.task_id = $${countParamIndex++}`
      countParams.push(filters.taskId)
    }
    if (filters?.startDate) {
      countQuery += ` AND scr.crawled_at >= $${countParamIndex++}`
      countParams.push(filters.startDate)
    }
    if (filters?.endDate) {
      countQuery += ` AND scr.crawled_at <= $${countParamIndex++}`
      countParams.push(filters.endDate)
    }

    const countResult = await this.prismaClient.$queryRawUnsafe(countQuery, ...countParams) as any[]
    const total = parseInt(countResult[0]?.total || '0', 10)

    return {
      items: results,
      total,
      page,
      pageSize,
    }
  }
}

export const interestSiteCrawlerService = new InterestSiteCrawlerService()

