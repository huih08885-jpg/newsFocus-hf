import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const crawlTaskSchema = z.object({
  siteIds: z.array(z.string()),
  type: z.enum(['today', 'range']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function POST(request: NextRequest) {
  console.log('[SiteCrawlAPI] ========== POST /api/sites/crawl ==========')
  try {
    console.log('[SiteCrawlAPI] Step 1: Authenticating user...')
    await getCurrentUser()
    console.log('[SiteCrawlAPI] Step 2: User authenticated, parsing request body...')
    
    const body = await request.json()
    console.log('[SiteCrawlAPI] Received request body:', JSON.stringify(body, null, 2))
    
    console.log('[SiteCrawlAPI] Step 3: Validating schema...')
    const input = crawlTaskSchema.parse(body)
    console.log('[SiteCrawlAPI] Validated input:', input)

    console.log('[SiteCrawlAPI] Step 4: Creating crawl tasks for sites:', input.siteIds)
    const tasks = await interestSiteCrawlerService.createCrawlTask({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    })

    console.log('[SiteCrawlAPI] Step 5: Created tasks:', tasks.length, 'tasks')
    console.log('[SiteCrawlAPI] Tasks details:', JSON.stringify(tasks, null, 2))
    
    const response = { success: true, data: tasks }
    console.log('[SiteCrawlAPI] Returning response:', JSON.stringify(response, null, 2))
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[SiteCrawlAPI] ========== ERROR ==========')
    console.error('[SiteCrawlAPI] Error type:', error?.constructor?.name)
    console.error('[SiteCrawlAPI] Error message:', error?.message)
    console.error('[SiteCrawlAPI] Error stack:', error?.stack)
    console.error('[SiteCrawlAPI] Full error:', error)
    
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create crawl task' },
      { status: 500 }
    )
  }
}

