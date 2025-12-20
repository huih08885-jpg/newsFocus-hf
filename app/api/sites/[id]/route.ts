import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()
    const site = await interestSiteCrawlerService.getSite(params.id)
    
    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: site })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()
    const body = await request.json()
    
    const site = await interestSiteCrawlerService.updateSite(params.id, body)
    return NextResponse.json({ success: true, data: site })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()
    await interestSiteCrawlerService.deleteSite(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

