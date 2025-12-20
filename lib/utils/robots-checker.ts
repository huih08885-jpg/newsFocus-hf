/**
 * Robots.txt 检查工具
 * 用于检查爬虫是否被允许访问特定URL
 */

interface RobotsRule {
  userAgent: string
  allow: string[]
  disallow: string[]
  crawlDelay?: number
}

interface RobotsCheckResult {
  allowed: boolean
  reason?: string
  crawlDelay?: number
}

/**
 * 简单的 robots.txt 解析器
 */
class RobotsParser {
  private rules: RobotsRule[] = []
  private defaultRule: RobotsRule = {
    userAgent: '*',
    allow: [],
    disallow: [],
  }

  constructor(robotsTxt: string) {
    this.parse(robotsTxt)
  }

  private parse(robotsTxt: string): void {
    const lines = robotsTxt.split('\n')
    let currentRule: RobotsRule | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const colonIndex = trimmed.indexOf(':')
      if (colonIndex === -1) {
        continue
      }

      const key = trimmed.substring(0, colonIndex).trim().toLowerCase()
      const value = trimmed.substring(colonIndex + 1).trim()

      if (key === 'user-agent') {
        // 保存上一个规则
        if (currentRule) {
          this.rules.push(currentRule)
        }
        // 创建新规则
        currentRule = {
          userAgent: value.toLowerCase(),
          allow: [],
          disallow: [],
        }
      } else if (key === 'allow' && currentRule) {
        currentRule.allow.push(value)
      } else if (key === 'disallow' && currentRule) {
        currentRule.disallow.push(value)
      } else if (key === 'crawl-delay' && currentRule) {
        const delay = parseFloat(value)
        if (!isNaN(delay)) {
          currentRule.crawlDelay = delay
        }
      }
    }

    // 保存最后一个规则
    if (currentRule) {
      this.rules.push(currentRule)
    }
  }

  /**
   * 检查URL是否被允许
   */
  isAllowed(url: string, userAgent: string = '*'): RobotsCheckResult {
    const urlPath = new URL(url).pathname
    const ua = userAgent.toLowerCase()

    // 查找匹配的规则（优先匹配具体的 user-agent）
    let matchedRule: RobotsRule | null = null
    let wildcardRule: RobotsRule | null = null

    for (const rule of this.rules) {
      if (rule.userAgent === ua || rule.userAgent === '*') {
        if (rule.userAgent === '*') {
          wildcardRule = rule
        } else {
          matchedRule = rule
          break
        }
      }
    }

    const rule = matchedRule || wildcardRule || this.defaultRule

    // 检查 disallow 规则
    for (const pattern of rule.disallow) {
      if (this.matchesPattern(urlPath, pattern)) {
        // 检查是否有 allow 规则覆盖
        let allowed = false
        for (const allowPattern of rule.allow) {
          if (this.matchesPattern(urlPath, allowPattern)) {
            allowed = true
            break
          }
        }
        if (!allowed) {
          return {
            allowed: false,
            reason: `Disallowed by robots.txt rule: ${pattern}`,
            crawlDelay: rule.crawlDelay,
          }
        }
      }
    }

    return {
      allowed: true,
      crawlDelay: rule.crawlDelay,
    }
  }

  /**
   * 检查路径是否匹配模式
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (!pattern) {
      return false
    }

    // 将 robots.txt 模式转换为正则表达式
    let regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\$/g, '$')
      .replace(/\./g, '\\.')

    // 如果模式以 / 开头，确保路径也以 / 开头
    if (pattern.startsWith('/')) {
      regexPattern = '^' + regexPattern
    } else {
      regexPattern = '.*' + regexPattern
    }

    const regex = new RegExp(regexPattern, 'i')
    return regex.test(path)
  }
}

/**
 * 检查 robots.txt 并返回是否允许访问
 */
export async function checkRobotsTxt(
  url: string,
  userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
): Promise<RobotsCheckResult> {
  try {
    const baseUrl = new URL(url).origin
    const robotsUrl = `${baseUrl}/robots.txt`

    // 尝试获取 robots.txt
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(5000), // 5秒超时
    })

    if (!response.ok) {
      // robots.txt 不存在或无法访问，默认允许（但记录日志）
      console.log(`[RobotsChecker] robots.txt not found for ${baseUrl}, defaulting to allowed`)
      return { allowed: true, reason: 'robots.txt not found' }
    }

    const robotsTxt = await response.text()
    const parser = new RobotsParser(robotsTxt)
    const result = parser.isAllowed(url, userAgent)

    if (!result.allowed) {
      console.warn(`[RobotsChecker] Access denied for ${url}: ${result.reason}`)
    } else if (result.crawlDelay) {
      console.log(`[RobotsChecker] Crawl delay recommended: ${result.crawlDelay}s for ${baseUrl}`)
    }

    return result
  } catch (error: any) {
    // 如果获取 robots.txt 失败，默认允许（但记录警告）
    if (error.name === 'AbortError') {
      console.warn(`[RobotsChecker] Timeout fetching robots.txt for ${url}`)
    } else {
      console.warn(`[RobotsChecker] Failed to check robots.txt for ${url}:`, error.message)
    }
    return { allowed: true, reason: 'Failed to fetch robots.txt' }
  }
}

/**
 * 批量检查多个URL（带缓存）
 */
const robotsCache = new Map<string, { result: RobotsCheckResult; timestamp: number }>()
const CACHE_TTL = 3600000 // 1小时

export async function checkRobotsTxtCached(
  url: string,
  userAgent?: string
): Promise<RobotsCheckResult> {
  const baseUrl = new URL(url).origin
  const cacheKey = `${baseUrl}:${userAgent || 'default'}`

  const cached = robotsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result
  }

  const result = await checkRobotsTxt(url, userAgent)
  robotsCache.set(cacheKey, { result, timestamp: Date.now() })
  return result
}

