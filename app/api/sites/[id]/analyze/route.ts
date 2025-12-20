import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()
    
    const result = await interestSiteCrawlerService.analyzeSite(params.id)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[SiteAnalyzeAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
}

