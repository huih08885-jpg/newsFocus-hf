import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser()
    const { searchParams } = new URL(request.url)
    
    const filters = {
      siteId: searchParams.get('siteId') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      taskId: searchParams.get('taskId') || undefined,
      startDate: searchParams.get('startDate') 
        ? new Date(searchParams.get('startDate')!) 
        : undefined,
      endDate: searchParams.get('endDate') 
        ? new Date(searchParams.get('endDate')!) 
        : undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    }

    const result = await interestSiteCrawlerService.getCrawlResults(filters)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[SiteCrawlResultsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

