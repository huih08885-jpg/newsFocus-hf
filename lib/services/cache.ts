// 缓存服务 - 使用Vercel KV或内存缓存

let kvClient: any = null
let kvInitialized = false

// 初始化Vercel KV（同步初始化，避免异步问题）
async function initKV() {
  if (kvInitialized) return
  
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const kv = await import('@vercel/kv')
      kvClient = kv.kv({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
      kvInitialized = true
    }
  } catch (error) {
    console.warn('Vercel KV not available, using memory cache:', error)
    kvInitialized = true // 标记为已初始化，避免重复尝试
  }
}

// 在模块加载时初始化（但不阻塞）
if (typeof window === 'undefined') {
  initKV().catch(() => {
    // 静默失败，使用内存缓存
  })
}

// 内存缓存作为后备
const memoryCache = new Map<string, { value: any; expiry: number }>()

export class CacheService {
  private defaultTTL = 900 // 15分钟

  async get<T>(key: string): Promise<T | null> {
    try {
      // 确保KV已初始化
      if (!kvInitialized) {
        await initKV()
      }
      
      // 尝试使用Vercel KV
      if (kvClient) {
        const value = await kvClient.get<T>(key)
        return value
      }

      // 使用内存缓存
      const cached = memoryCache.get(key)
      if (cached && cached.expiry > Date.now()) {
        return cached.value as T
      }

      // 过期或不存在
      if (cached) {
        memoryCache.delete(key)
      }

      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
    try {
      // 确保KV已初始化
      if (!kvInitialized) {
        await initKV()
      }
      
      // 尝试使用Vercel KV
      if (kvClient) {
        await kvClient.set(key, value, { ex: ttl })
        return
      }

      // 使用内存缓存
      memoryCache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      })

      // 清理过期项（每100次操作清理一次）
      if (memoryCache.size % 100 === 0) {
        this.cleanup()
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // 确保KV已初始化
      if (!kvInitialized) {
        await initKV()
      }
      
      if (kvClient) {
        await kvClient.del(key)
        return
      }

      memoryCache.delete(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      if (kvClient) {
        // Vercel KV不支持模式匹配，需要手动管理key
        // 这里简化处理
        return
      }

      // 内存缓存模式匹配
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern)) {
          memoryCache.delete(key)
        }
      }
    } catch (error) {
      console.error('Cache invalidate error:', error)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of memoryCache.entries()) {
      if (cached.expiry <= now) {
        memoryCache.delete(key)
      }
    }
  }
}

export const cache = new CacheService()

