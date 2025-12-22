import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser() // 验证登录

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const status = searchParams.get('status')
    const analysisStatus = searchParams.get('analysisStatus')

    const sites = await interestSiteCrawlerService.getSites({
      groupId: groupId || undefined,
      status: status || undefined,
      analysisStatus: analysisStatus || undefined,
    })

    return NextResponse.json({ success: true, data: sites })
  } catch (error: any) {
    console.error('[SitesAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sites' },
      { status: 500 }
    )
  }
}

