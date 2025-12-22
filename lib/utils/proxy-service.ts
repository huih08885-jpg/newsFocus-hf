/**
 * 代理服务管理器
 * 支持多种代理服务提供商，自动选择可用的代理
 */

import { logger } from './logger'

export interface ProxyConfig {
  // 代理服务类型
  type: 'scraperapi' | 'brightdata' | 'custom' | 'jina' | 'none'
  // API Key（如果需要）
  apiKey?: string
  // 自定义代理URL模板（如：https://api.proxy.com?url={url}）
  customUrl?: string
  // 是否在Vercel环境中强制使用代理
  forceInVercel?: boolean
}

/**
 * 构建代理URL
 */
export function buildProxyUrl(originalUrl: string, config?: ProxyConfig): string | null {
  // 如果没有配置代理，返回null
  if (!config || config.type === 'none') {
    return null
  }

  // 检测是否在Vercel环境
  const isVercel = process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL
  
  // 如果配置了强制在Vercel使用代理，但不在Vercel环境，返回null
  if (config.forceInVercel && !isVercel) {
    return null
  }

  try {
    const encodedUrl = encodeURIComponent(originalUrl)

    switch (config.type) {
      case 'scraperapi':
        if (!config.apiKey) {
          logger.warn('ScraperAPI需要API Key', 'ProxyService')
          return null
        }
        // ScraperAPI格式: https://api.scraperapi.com?api_key=KEY&url=URL
        return `https://api.scraperapi.com?api_key=${config.apiKey}&url=${encodedUrl}`

      case 'brightdata':
        if (!config.apiKey) {
          logger.warn('Bright Data需要API Key', 'ProxyService')
          return null
        }
        // Bright Data格式: https://brd.superproxy.io:22225?api_key=KEY&url=URL
        return `https://brd.superproxy.io:22225?api_key=${config.apiKey}&url=${encodedUrl}`

      case 'custom':
        if (!config.customUrl) {
          logger.warn('自定义代理需要customUrl', 'ProxyService')
          return null
        }
        // 自定义格式: 替换 {url} 或 {encodedUrl}
        return config.customUrl
          .replace('{url}', originalUrl)
          .replace('{encodedUrl}', encodedUrl)

      case 'jina':
        // Jina AI代理（免费但可能不稳定）
        return `https://r.jina.ai/${encodedUrl}`

      default:
        return null
    }
  } catch (error) {
    logger.warn('构建代理URL失败', 'ProxyService', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * 从环境变量获取代理配置
 */
export function getProxyConfigFromEnv(): ProxyConfig | null {
  // 检查是否禁用代理
  if (process.env.DISABLE_PROXY === 'true') {
    return { type: 'none' }
  }

  // 优先使用ScraperAPI
  if (process.env.SCRAPERAPI_KEY) {
    return {
      type: 'scraperapi',
      apiKey: process.env.SCRAPERAPI_KEY,
      forceInVercel: true, // 在Vercel环境强制使用
    }
  }

  // 其次使用Bright Data
  if (process.env.BRIGHTDATA_KEY) {
    return {
      type: 'brightdata',
      apiKey: process.env.BRIGHTDATA_KEY,
      forceInVercel: true,
    }
  }

  // 自定义代理URL
  if (process.env.CUSTOM_PROXY_URL) {
    return {
      type: 'custom',
      customUrl: process.env.CUSTOM_PROXY_URL,
      forceInVercel: true,
    }
  }

  // 最后尝试Jina AI（免费但可能不稳定）
  if (process.env.USE_JINA_PROXY === 'true') {
    return {
      type: 'jina',
      forceInVercel: true,
    }
  }

  return null
}

/**
 * 获取代理目标列表
 * 返回所有可用的代理URL（按优先级排序）
 */
export function getProxyTargets(originalUrl: string): string[] {
  const config = getProxyConfigFromEnv()
  
  if (!config || config.type === 'none') {
    // 如果没有配置代理，返回空数组
    return []
  }

  const proxyUrl = buildProxyUrl(originalUrl, config)
  
  if (!proxyUrl) {
    return []
  }

  return [proxyUrl]
}

/**
 * 检测是否应该使用代理
 */
export function shouldUseProxy(): boolean {
  // 检测是否在Vercel环境
  const isVercel = process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL
  
  // 在Vercel环境中，如果有代理配置，应该使用代理
  if (isVercel) {
    const config = getProxyConfigFromEnv()
    return config !== null && config.type !== 'none'
  }

  // 开发环境：根据配置决定
  const config = getProxyConfigFromEnv()
  return config !== null && config.type !== 'none'
}

