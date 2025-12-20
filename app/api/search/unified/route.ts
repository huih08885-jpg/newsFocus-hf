import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SearchOrchestrator } from '@/lib/services/search-orchestrator'

const payloadSchema = z.object({
  keywords: z.array(z.string().min(1)).nonempty(),
  includePlatforms: z.array(z.string().min(1)).optional(),
  limitPerPlatform: z.number().int().min(1).max(50).optional(),
  searchEngines: z.array(z.string().min(1)).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const orchestrator = new SearchOrchestrator()
    const result = await orchestrator.unifiedSearch({
      keywords: payload.keywords,
      includePlatforms: payload.includePlatforms,
      limitPerPlatform: payload.limitPerPlatform || 10, // 每个搜索引擎每次10条
      searchEngines: payload.searchEngines || ['baidu', 'bing', 'nano'], // 默认三个搜索引擎
      page: payload.page || 1,
      pageSize: payload.pageSize || 30, // 每页30条（10+10+10）
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[UnifiedSearchAPI] error', error)
    // 安全地提取错误消息，避免序列化包含循环引用的对象
    let errorMessage = 'unified search failed'
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message
      } else if (typeof error.toString === 'function') {
        try {
          errorMessage = error.toString()
        } catch {
          // 如果 toString 也失败，使用默认消息
        }
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    )
  }
}

