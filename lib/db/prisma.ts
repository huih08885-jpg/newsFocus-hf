import { PrismaClient } from '@prisma/client'

// 全局变量，用于在开发环境中重用 Prisma 客户端
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// 根据环境配置 Prisma 客户端
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // 检查是否是 Neon 数据库（包含 neon.tech）
  const isNeon = databaseUrl.includes('neon.tech')
  
  // 检查是否是开发环境
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Prisma 客户端配置
  const prisma = new PrismaClient({
    log: isDevelopment
      ? ['query', 'error', 'warn']
      : ['error'],
  })

  // 如果是 Neon 数据库，配置连接池
  if (isNeon) {
    // Neon 使用连接池，不需要特殊配置
    // Prisma 会自动处理连接池
  } else {
    // PostgreSQL 11 本地开发环境配置
    if (isDevelopment) {
      // 开发环境可以启用更详细的日志
      console.log('🔧 Using local PostgreSQL 11 database')
    }
  }

  return prisma
}

// 在开发环境中，使用全局变量避免创建多个 Prisma 客户端实例
// 在生产环境中，每次都创建新实例
let prismaInstance: PrismaClient

try {
  prismaInstance = globalThis.__prisma ?? createPrismaClient()
  
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prismaInstance
  }
} catch (error) {
  console.error('Failed to initialize Prisma client:', error)
  // 创建一个占位符客户端，避免应用崩溃
  prismaInstance = new PrismaClient({
    log: ['error'],
  })
}

export const prisma: PrismaClient = prismaInstance

// 优雅关闭连接
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
  
  process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

export default prisma
