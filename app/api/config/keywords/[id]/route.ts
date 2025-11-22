import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, words, requiredWords, excludedWords, priority, enabled } = body

    const keywordGroup = await prisma.keywordGroup.update({
      where: { id: params.id },
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
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.keywordGroup.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      data: { message: '关键词组已删除' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

