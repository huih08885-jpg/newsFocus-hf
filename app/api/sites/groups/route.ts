import { NextRequest, NextResponse } from 'next/server'
import { interestSiteCrawlerService } from '@/lib/services/interest-site-crawler'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser()
    const groups = await interestSiteCrawlerService.getGroups()
    return NextResponse.json({ success: true, data: groups })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await getCurrentUser()
    const body = await request.json()
    const group = await interestSiteCrawlerService.createGroup(body)
    return NextResponse.json({ success: true, data: group })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

