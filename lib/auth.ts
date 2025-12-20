import { prisma } from '@/lib/db/prisma'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const SESSION_COOKIE_NAME = 'newsfocus_session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天

export interface User {
  id: string
  email: string
  name: string | null
  role: string
}

/**
 * 获取当前登录用户
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    if (!prisma) {
      console.error('Prisma client is not initialized')
      return null
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return null
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      // 会话已过期，删除
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
      }
      return null
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * 创建会话
 */
export async function createSession(userId: string): Promise<string> {
  if (!prisma) {
    throw new Error('Prisma client is not initialized')
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  return token
}

/**
 * 删除会话
 */
export async function deleteSession(token: string): Promise<void> {
  if (!prisma) {
    console.error('Prisma client is not initialized')
    return
  }

  await prisma.session.deleteMany({
    where: { token },
  })
}

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions(): Promise<void> {
  if (!prisma) {
    console.error('Prisma client is not initialized')
    return
  }

  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

