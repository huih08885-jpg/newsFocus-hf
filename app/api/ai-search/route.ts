import { NextResponse } from 'next/server'
import { z } from 'zod'
import { aiSearchService } from '@/lib/services/ai-search'

const payloadSchema = z.object({
  keywords: z.array(z.string().min(1)).nonempty(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  searchEngines: z.array(z.string().min(1)).optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
  includeAnalysis: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const result = await aiSearchService.search({
      keywords: payload.keywords,
      startDate: payload.startDate,
      endDate: payload.endDate,
      searchEngines: payload.searchEngines,
      maxResults: payload.maxResults || 20,
      includeAnalysis: payload.includeAnalysis !== false, // 默认 true
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('[AISearchAPI] error', error)
    
    let errorMessage = 'AI 搜索失败'
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message
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

