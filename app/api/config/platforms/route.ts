import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const platforms = await prisma.platform.findMany({
      orderBy: { platformId: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        items: platforms,
        total: platforms.length,
      },
    })
  } catch (error) {
    console.error('Error fetching platforms:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, enabled } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAM',
            message: 'id is required',
          },
        },
        { status: 400 }
      )
    }

    const platform = await prisma.platform.update({
      where: { id },
      data: { enabled },
    })

    return NextResponse.json({
      success: true,
      data: platform,
    })
  } catch (error) {
    console.error('Error updating platform:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

