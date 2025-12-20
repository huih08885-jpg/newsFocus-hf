import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SiteSubscriptionService } from '@/lib/services/site-subscription'

const payloadSchema = z.object({
  keywordGroupId: z.string().optional(),
  domain: z.string().optional(),
  title: z.string().optional(),
  url: z.string().url(),
  snippet: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  configDraft: z.any().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const service = new SiteSubscriptionService()
    const candidate = await service.subscribeSite(payload)

    return NextResponse.json({ success: true, data: candidate })
  } catch (error: any) {
    console.error('[SiteSubscribeAPI] error', error)
    // 安全地提取错误消息，避免序列化包含循环引用的对象
    let errorMessage = 'site subscribe failed'
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

