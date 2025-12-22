import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser()

    // 直接查询 site_candidates 表
    const rawSites = await prisma.$queryRaw`
      SELECT * FROM site_candidates LIMIT 10
    ` as any[]

    // 使用 Prisma 查询
    const prismaSites = await prisma.siteCandidate.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        rawCount: rawSites.length,
        rawSites: rawSites,
        prismaCount: prismaSites.length,
        prismaSites: prismaSites,
      },
    })
  } catch (error: any) {
    console.error('[SitesDebugAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to debug' },
      { status: 500 }
    )
  }
}

