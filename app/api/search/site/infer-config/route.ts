import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ConfigInferenceService } from '@/lib/services/config-inference'

const payloadSchema = z.object({
  url: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const service = new ConfigInferenceService()
    const result = await service.inferFromUrl(payload.url)

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[SiteInferConfigAPI] error', error)
    // 安全地提取错误消息，避免序列化包含循环引用的对象
    let errorMessage = 'infer config failed'
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
      { success: false, error: errorMessage },
      { status: 400 }
    )
  }
}

