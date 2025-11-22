import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const keywordGroups = await prisma.keywordGroup.findMany({
      orderBy: { priority: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        items: keywordGroups,
        total: keywordGroups.length,
      },
    })
  } catch (error) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, words, requiredWords, excludedWords, priority, enabled } = body

    const keywordGroup = await prisma.keywordGroup.create({
      data: {
        name,
        words: words || [],
        requiredWords: requiredWords || [],
        excludedWords: excludedWords || [],
        priority: priority ?? 0,
        enabled: enabled ?? true,
      },
    })

    return NextResponse.json({
      success: true,
      data: keywordGroup,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

