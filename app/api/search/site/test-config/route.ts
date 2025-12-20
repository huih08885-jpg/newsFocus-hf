import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SiteConfigValidator } from '@/lib/services/site-config-validator'

const payloadSchema = z.object({
  config: z.object({
    type: z.literal('html'),
    baseUrl: z.string().url().optional(),
    list: z.object({
      url: z.string().url(),
      itemSelector: z.string().min(1),
      method: z.enum(['GET', 'POST']).optional(),
      headers: z.record(z.string()).optional(),
      params: z.record(z.string()).optional(),
      body: z.string().optional(),
      limit: z.number().optional(),
      fields: z.object({
        title: z.object({
          selector: z.string().optional(),
          attribute: z.string().optional(),
          regex: z.string().optional(),
        }),
        url: z
          .object({
            selector: z.string().optional(),
            attribute: z.string().optional(),
            regex: z.string().optional(),
          })
          .optional(),
        publishedAt: z
          .object({
            selector: z.string().optional(),
            attribute: z.string().optional(),
            regex: z.string().optional(),
          })
          .optional(),
        summary: z
          .object({
            selector: z.string().optional(),
            attribute: z.string().optional(),
            regex: z.string().optional(),
          })
          .optional(),
      }),
      keywordParam: z.string().optional(),
      filters: z
        .object({
          minTitleLength: z.number().optional(),
          maxTitleLength: z.number().optional(),
          requireUrl: z.boolean().optional(),
        })
        .optional(),
    }),
    search: z
      .any()
      .optional(), // 保留 search 配置原样，由 ConfigurableHtmlCrawler 处理
  }),
  keywords: z.array(z.string()).optional(),
  limit: z.number().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const validator = new SiteConfigValidator()
    const result = await validator.test({
      config: payload.config,
      keywords: payload.keywords,
      limit: payload.limit,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[SiteTestConfigAPI] error', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'test config failed' },
      { status: 400 }
    )
  }
}

