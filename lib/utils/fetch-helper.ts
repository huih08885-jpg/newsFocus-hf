/**
 * 增强的Fetch工具
 * 提供更真实的浏览器行为，绕过反爬虫机制
 */

import { checkRobotsTxtCached } from './robots-checker'

const DEFAULT_HEADERS = {
  // 使用真实浏览器User-Agent，移除项目标识（避免被识别为爬虫）
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}

const JSON_HEADERS = {
  ...DEFAULT_HEADERS,
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
}

const BLOCKED_STATUS_CODES = new Set([401, 402, 403, 404, 409, 410, 412, 418, 429, 430, 431, 432, 444, 451])

export interface FetchOptions extends RequestInit {
  retries?: number
  retryDelay?: number
  timeout?: number
  referer?: string
  origin?: string
  useJsonHeaders?: boolean
  proxyFallback?: boolean
  checkRobots?: boolean // 是否检查 robots.txt，默认 true
}

function buildProxyTargets(url: string): string[] {
  // 使用代理服务管理器获取代理目标
  try {
    // 动态导入代理服务管理器
    // 注意：这里使用同步方式，因为 getProxyTargets 是同步函数
    let getProxyTargets: (url: string) => string[]
    try {
      const proxyService = require('./proxy-service')
      getProxyTargets = proxyService.getProxyTargets
    } catch (importError) {
      // 如果导入失败，使用Jina AI作为后备
      const encodedUrl = encodeURIComponent(url)
      return [`https://r.jina.ai/${encodedUrl}`]
    }
    
    const targets = getProxyTargets(url)
    
    // 如果没有配置代理，尝试使用Jina AI作为后备（免费但可能不稳定）
    if (targets.length === 0 && process.env.USE_JINA_PROXY !== 'false') {
      const encodedUrl = encodeURIComponent(url)
      return [`https://r.jina.ai/${encodedUrl}`]
    }
    
    return targets
  } catch (error) {
    // 如果导入失败，使用Jina AI作为后备
    try {
      const encodedUrl = encodeURIComponent(url)
      return [`https://r.jina.ai/${encodedUrl}`]
    } catch (encodeError) {
      return []
    }
  }
}

/**
 * 增强的fetch，带重试和超时
 */
export async function enhancedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 10000,
    referer,
    origin,
    useJsonHeaders = false,
    headers = {},
    proxyFallback = false,
    ...fetchOptions
  } = options

  const baseHeaders = useJsonHeaders ? JSON_HEADERS : DEFAULT_HEADERS
  const finalHeaders = {
    ...baseHeaders,
    ...(referer && { Referer: referer }),
    ...(origin && { Origin: origin }),
    ...headers,
  }

  let lastError: Error | null = null

  const targets = [url, ...(proxyFallback ? buildProxyTargets(url) : [])]

  for (const target of targets) {
    const isProxyTarget = target !== url

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        // 如果是代理目标，需要调整请求头（移除可能被代理服务拒绝的头部）
        const requestHeaders = isProxyTarget ? {
          ...finalHeaders,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        } : finalHeaders

        const response = await fetch(target, {
          ...fetchOptions,
          headers: requestHeaders,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          if (isProxyTarget) {
            console.info(`[FetchHelper] 使用代理成功获取 ${url}`)
          }
          return response
        }

        const status = response.status
        const statusText = response.statusText
        const blocked = BLOCKED_STATUS_CODES.has(status)

        if (!isProxyTarget && proxyFallback && blocked) {
          console.warn(`[FetchHelper] ${url} 返回 ${status}，尝试使用代理...`)
          // 跳出当前目标，尝试代理
          break
        }
        
        // 如果是代理目标也返回错误，记录详细信息并立即抛出
        if (isProxyTarget && !response.ok) {
          const proxyErrorMsg = `代理服务也返回 ${status}: ${statusText}，原始URL: ${url}`
          console.warn(`[FetchHelper] ${proxyErrorMsg}`)
          lastError = new Error(`HTTP ${status}: ${statusText} - ${proxyErrorMsg}`)
          // 代理也失败，不再重试
          throw lastError
        }

        const errorMsg = `HTTP ${status}: ${statusText}`
        lastError = new Error(errorMsg)

        if (attempt < retries && status >= 400) {
          console.warn(`[FetchHelper] ${target} 返回 ${status}，${retryDelay}ms后重试 (${attempt + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
          continue
        }

        // 到达这里说明无需重试（或已是代理），直接抛错
        throw lastError
      } catch (error: any) {
        lastError = error

        if (error.name === 'AbortError') {
          console.warn(`[FetchHelper] ${target} 请求超时，${retryDelay}ms后重试 (${attempt + 1}/${retries})`)
        } else {
          console.warn(`[FetchHelper] ${target} 请求失败: ${error.message}，${retryDelay}ms后重试 (${attempt + 1}/${retries})`)
        }

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      }
    }
  }

  throw lastError || new Error(`请求失败: ${url}`)
}

/**
 * 获取HTML内容
 */
export async function fetchHTML(url: string, options: FetchOptions = {}): Promise<string> {
  // 检查 robots.txt（如果启用）
  const checkRobots = options.checkRobots !== false // 默认检查
  if (checkRobots) {
    // 安全地获取 User-Agent
    let userAgent = DEFAULT_HEADERS['User-Agent']
    if (options.headers) {
      if (Array.isArray(options.headers)) {
        const uaHeader = options.headers.find(([key]) => key.toLowerCase() === 'user-agent')
        if (uaHeader) userAgent = uaHeader[1] as string
      } else if (options.headers instanceof Headers) {
        userAgent = options.headers.get('User-Agent') || userAgent
      } else {
        userAgent = (options.headers['User-Agent'] as string) || userAgent
      }
    }
    const robotsResult = await checkRobotsTxtCached(url, userAgent)
    
    if (!robotsResult.allowed) {
      throw new Error(`Access denied by robots.txt: ${robotsResult.reason}`)
    }
    
    // 如果 robots.txt 建议了 crawl delay，应用延迟
    if (robotsResult.crawlDelay && robotsResult.crawlDelay > 0) {
      const delayMs = Math.ceil(robotsResult.crawlDelay * 1000)
      console.log(`[FetchHelper] Applying crawl delay: ${delayMs}ms for ${url}`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  const response = await enhancedFetch(url, {
    ...options,
    useJsonHeaders: false,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // 获取原始字节数据
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // 尝试检测编码
  let html = ''
  try {
    // 先尝试 UTF-8
    html = buffer.toString('utf-8')
    
    // 检查 HTML 中的 charset 声明
    const charsetMatch = html.match(/charset=["']?([^"'\s>]+)/i)
    const declaredCharset = charsetMatch ? charsetMatch[1].toLowerCase() : null
    
    // 如果声明了 GBK 或 GB2312，重新解码
    if (declaredCharset && (declaredCharset.includes('gbk') || declaredCharset.includes('gb2312'))) {
      try {
        const iconv = require('iconv-lite')
        html = iconv.decode(buffer, 'gbk')
        // 更新 HTML 中的 charset 声明
        html = html.replace(/charset=["']?[^"'\s>]+["']?/gi, 'charset="utf-8"')
      } catch (e) {
        console.warn(`[FetchHelper] Failed to convert from ${declaredCharset} to UTF-8:`, e)
        // 如果转换失败，使用原始 UTF-8 解码（可能已经是乱码）
      }
    }
  } catch (e) {
    // 如果 UTF-8 解码失败，尝试 GBK
    try {
      const iconv = require('iconv-lite')
      html = iconv.decode(buffer, 'gbk')
      html = html.replace(/charset=["']?[^"'\s>]+["']?/gi, 'charset="utf-8"')
    } catch (e2) {
      // 最后尝试使用 buffer 的默认 toString
      html = buffer.toString()
    }
  }
  
  return html
}

/**
 * 获取JSON内容
 */
export async function fetchJSON<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await enhancedFetch(url, {
    ...options,
    useJsonHeaders: true,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '无法读取响应内容')
    const errorMsg = `HTTP ${response.status}: ${response.statusText}`
    console.error(`[FetchHelper] ${url} 请求失败:`, errorMsg)
    if (errorText && errorText.length < 500) {
      console.error(`[FetchHelper] 响应内容:`, errorText)
    }
    throw new Error(errorMsg)
  }

  try {
    return await response.json()
  } catch (jsonError: any) {
    const text = await response.text().catch(() => '无法读取响应内容')
    console.error(`[FetchHelper] ${url} JSON解析失败:`, jsonError.message)
    console.error(`[FetchHelper] 响应内容 (前500字符):`, text.substring(0, 500))
    throw new Error(`JSON解析失败: ${jsonError.message}`)
  }
}

