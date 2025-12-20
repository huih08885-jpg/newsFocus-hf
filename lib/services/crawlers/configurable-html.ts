import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML } from '@/lib/utils/fetch-helper'
import type { PlatformCrawler, CrawlResult, CrawlOptions, NewsItem } from './base'
import type { Cheerio } from 'cheerio'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const CONTENT_SELECTORS = [
  'article',
  '.article',
  '.article-content',
  '.rich-text',
  '.content',
  '.detail',
  '.post-content',
  '.main-content',
  '.article-body',
  '#article',
  '#content',
]

const MIN_CONTENT_LENGTH = 80 // 最小内容长度
const CONTENT_CHECK_TIMEOUT = 5000 // 内容检查超时时间（毫秒）

export interface HtmlFieldConfig {
  selector?: string
  attribute?: string
  regex?: string
}

export interface HtmlListConfig {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: string
  itemSelector: string
  limit?: number
  fields: {
    title: HtmlFieldConfig
    url?: HtmlFieldConfig
    publishedAt?: HtmlFieldConfig
    summary?: HtmlFieldConfig
  }
  keywordParam?: string
  // 过滤配置
  filters?: {
    minTitleLength?: number // 最小标题长度，默认 3
    maxTitleLength?: number // 最大标题长度，默认 200
    requireUrl?: boolean // 是否必须有URL，默认 true
    excludeNavPatterns?: (string | RegExp)[] // 排除的导航模式（正则表达式或字符串数组）
    excludeUrlPatterns?: (string | RegExp)[] // 排除的URL模式（正则表达式或字符串数组）
    excludeParentSelectors?: string[] // 排除的父元素选择器（如 nav, header, footer）
  }
}

export interface ConfigurableHtmlCrawlerConfig {
  type: 'html'
  baseUrl?: string
  list: HtmlListConfig
  search?: HtmlListConfig
}

/**
 * 内容检查器
 * 检查链接中是否有实际的文章内容（文字、视频等）
 */
interface ContentCheckResult {
  hasContent: boolean
  hasText: boolean
  hasVideo: boolean
  reason?: string
  textSnippet?: string
}

class ContentChecker {
  private cache = new Map<string, ContentCheckResult>()

  constructor(private baseUrl?: string) {}

  /**
   * 检查URL是否有实际内容
   * @param url 要检查的URL
   * @returns 返回是否有内容，以及内容类型
   */
  async hasContent(url: string): Promise<ContentCheckResult> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!
    }

    try {
      const referer = this.baseUrl || this.tryGetOrigin(url)
      const html = await fetchHTML(url, {
        headers: DEFAULT_HEADERS,
        timeout: CONTENT_CHECK_TIMEOUT,
        referer,
        origin: referer,
        retries: 1,
        proxyFallback: true,
      })
      const $ = HTMLParser.parse(html)

      // 移除无关标签和元素
      $('script, style, noscript, iframe, nav, header, footer, aside').remove()
      
      // 移除常见的导航和侧边栏元素
      $('.nav, .navbar, .navigation, .sidebar, .menu, .breadcrumb, .header, .footer, .ad, .advertisement, .ads').remove()
      $('[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').remove()
      $('[class*="nav"], [class*="menu"], [class*="sidebar"], [class*="header"], [class*="footer"], [class*="ad"]').remove()

      // 1. 检查文字内容
      let hasText = false
      let textContent = ''

      // 先尝试从常见的内容选择器提取
      for (const selector of CONTENT_SELECTORS) {
        const candidate = $(selector)
        if (candidate.length === 0) continue

        const text = this.extractText(candidate, $)
        if (text && text.length >= MIN_CONTENT_LENGTH) {
          hasText = true
          textContent = text
          break
        }
      }

      // 如果没找到，尝试从 body 提取（但排除导航和侧边栏）
      if (!hasText) {
        // 创建一个干净的 body 副本
        const $cleanBody = $('body').clone()
        // 再次移除导航和侧边栏
        $cleanBody.find('nav, header, footer, aside, .nav, .navbar, .sidebar, .menu, .breadcrumb, [role="navigation"]').remove()
        // 移除链接列表（可能是导航）
        $cleanBody.find('ul.nav, ul.menu, ol.nav, ol.menu').remove()
        // 移除只有链接的 div（可能是导航）
        $cleanBody.find('div').each((_, el) => {
          const $el = $(el)
          const links = $el.find('a').length
          const text = $el.text().trim()
          // 如果 div 中主要是链接且文本很短，可能是导航
          if (links > 0 && text.length < 50 && links / (text.length || 1) > 0.3) {
            $el.remove()
          }
        })
        
        const bodyText = this.normalizeText($cleanBody.text(), true)
        if (bodyText.length >= MIN_CONTENT_LENGTH / 2) {
          hasText = true
          textContent = bodyText
        }
      }

      // 2. 检查视频内容
      const hasVideo = $('video').length > 0 || 
                       $('iframe[src*="youtube"], iframe[src*="youku"], iframe[src*="bilibili"], iframe[src*="v.qq.com"]').length > 0 ||
                       $('[class*="video"], [id*="video"]').length > 0

      const hasContent = hasText || hasVideo
      const result: ContentCheckResult = {
        hasContent,
        hasText,
        hasVideo,
        reason: hasContent ? undefined : '未找到足够的文字或视频内容',
        textSnippet: hasText ? textContent.slice(0, 800) : undefined,
      }

      this.cache.set(url, result)
      return result
    } catch (error: any) {
      const result: ContentCheckResult = {
        hasContent: false,
        hasText: false,
        hasVideo: false,
        reason: error?.name === 'AbortError'
          ? '请求超时'
          : (error?.message || '请求失败'),
      }
      this.cache.set(url, result)
      return result
    }
  }

  private tryGetOrigin(targetUrl: string): string | undefined {
    try {
      const parsed = new URL(targetUrl)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return this.baseUrl
    }
  }

  private extractText($container: Cheerio<any>, $: any): string | null {
    // 先移除容器内的导航和侧边栏元素
    const $cleanContainer = $container.clone()
    $cleanContainer.find('nav, header, footer, aside, .nav, .navbar, .sidebar, .menu, .breadcrumb, [role="navigation"]').remove()
    
    // 过滤掉导航链接列表
    $cleanContainer.find('ul, ol').each((_: any, el: any) => {
      const $list = $(el)
      const links = $list.find('a').length
      const items = $list.find('li').length
      // 如果列表中主要是链接（超过70%），可能是导航
      if (items > 0 && links / items > 0.7) {
        $list.remove()
      }
    })
    
    // 提取文本块
    const blocks = $cleanContainer
      .find('p, h1, h2, h3, h4, h5, h6, blockquote, div.paragraph, div.content')
      .filter((_: any, el: any) => {
        const $el = $(el)
        const text = $el.text().trim()
        const links = $el.find('a').length
        // 过滤掉太短的文本块（可能是导航项）
        if (text.length < 10) return false
        // 过滤掉主要是链接的块（可能是导航）
        if (links > 0 && text.length < 50 && links / text.length > 0.2) return false
        // 过滤掉常见的导航文本
        const navKeywords = ['首页', '关于', '联系我们', '登录', '注册', '更多', '返回', '搜索', '分类', '标签', '归档', 'RSS', '订阅', '帮助', '收藏', '官方微博', '官方微信', '扫描二维码']
        if (navKeywords.some(keyword => text.includes(keyword) && text.length < 30)) return false
        return true
      })
      .map((_: any, el: any) => {
        const text = $(el).text().trim()
        // 过滤掉常见的导航文本
        const navKeywords = ['首页', '关于', '联系我们', '登录', '注册', '更多', '返回', '搜索', '分类', '标签', '归档', 'RSS', '订阅', '帮助']
        if (navKeywords.some(keyword => text === keyword || (text.includes(keyword) && text.length < 20))) {
          return ''
        }
        return text
      })
      .get()
      .filter((text: string) => text.length >= 10) // 只保留至少10个字符的文本块
      .join('\n\n')

    const text = this.normalizeText(blocks || $cleanContainer.text(), true)
    return text && text.length >= MIN_CONTENT_LENGTH ? text : null
  }

  private normalizeText(text: string, preserveNewlines = false): string {
    if (!text) return ''

    let cleaned = text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n')

    if (preserveNewlines) {
      cleaned = cleaned
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
    } else {
      cleaned = cleaned.replace(/\s+/g, ' ')
    }

    return cleaned.trim()
  }
}

/**
 * 智能文章过滤器
 * 用于过滤掉导航链接、非文章内容等
 */
class ArticleFilter {
  private filters: {
    minTitleLength: number
    maxTitleLength: number
    requireUrl: boolean
    excludeNavPatterns: RegExp[]
    excludeUrlPatterns: RegExp[]
    excludeParentSelectors: string[]
  }

  constructor(
    filters?: HtmlListConfig['filters'],
    private contentChecker: ContentChecker = new ContentChecker()
  ) {
    // 将字符串或RegExp转换为RegExp数组
    const normalizePatterns = (patterns?: (string | RegExp)[]): RegExp[] => {
      if (!patterns) return []
      return patterns.map(p => typeof p === 'string' ? new RegExp(p) : p)
    }

    this.filters = {
      minTitleLength: filters?.minTitleLength ?? 3,
      maxTitleLength: filters?.maxTitleLength ?? 200,
      requireUrl: filters?.requireUrl ?? true,
      excludeNavPatterns: filters?.excludeNavPatterns 
        ? normalizePatterns(filters.excludeNavPatterns)
        : [
        // 常见的导航关键词模式（不写死具体词，而是模式）
        /^(首页|主页|home|index)$/i,
        /^(关于|关于我们|about)$/i,
        /^(联系我们|contact)$/i,
        /^(登录|注册|login|signin|signup)$/i,
        /^(更多|more|更多信息)$/i,
        /^(返回|back|返回首页)$/i,
        /^(搜索|search)$/i,
        /^(分类|分类目录|category|categories)$/i,
        /^(标签|tag|tags)$/i,
        /^(归档|archive)$/i,
        /^(友情链接|links)$/i,
        /^(站点地图|sitemap)$/i,
        /^(RSS|订阅|feed)$/i,
        /^(帮助|help|faq)$/i,
        /^(隐私|privacy|政策|policy)$/i,
        /^(条款|terms|服务|service)$/i,
        /^(广告|ad|advertisement)$/i,
        /^(招聘|jobs|career)$/i,
        /^(加入我们|join)$/i,
        /^(新闻|news|资讯|information)$/i, // 如果只是"新闻"这个词本身，可能是导航
        /^(技术|tech|技术文档)$/i, // 如果只是"技术"这个词本身，可能是导航
        /^(学术|academic|学术研究)$/i, // 如果只是"学术"这个词本身，可能是导航
        ],
      excludeUrlPatterns: filters?.excludeUrlPatterns
        ? normalizePatterns(filters.excludeUrlPatterns)
        : [
        // 排除的URL模式
        /^#/, // 锚点链接
        /^javascript:/i, // JavaScript链接
        /\/index\.(html?|php|aspx?)$/i, // 首页链接
        /\/home\.(html?|php|aspx?)$/i,
        /\/about\.(html?|php|aspx?)$/i,
        /\/contact\.(html?|php|aspx?)$/i,
        /\/login\.(html?|php|aspx?)$/i,
        /\/register\.(html?|php|aspx?)$/i,
        /\/search\.(html?|php|aspx?)$/i,
        /\/category\/?$/i, // 分类页面（无具体分类）
        /\/tag\/?$/i, // 标签页面（无具体标签）
        /\/archive\/?$/i, // 归档页面（无具体日期）
        /\/feed\/?$/i, // RSS feed
        /\/sitemap/i, // 站点地图
      ],
      excludeParentSelectors: filters?.excludeParentSelectors ?? [
        'nav',
        'header',
        'footer',
        '.nav',
        '.navbar',
        '.navigation',
        '.header',
        '.footer',
        '.menu',
        '.sidebar',
        '.breadcrumb',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
      ],
    }
  }

  /**
   * 检查是否是有效的文章（同步检查，基于规则）
   */
  isValidArticle(
    title: string,
    url: string | null | undefined,
    $el: Cheerio<any>
  ): { valid: boolean; reason?: string } {
    // 1. 标题长度检查
    const trimmedTitle = title.trim()
    const titleLength = trimmedTitle.length
    if (titleLength < this.filters.minTitleLength) {
      return { valid: false, reason: `标题太短 (${titleLength} < ${this.filters.minTitleLength})` }
    }
    if (titleLength > this.filters.maxTitleLength) {
      return { valid: false, reason: `标题太长 (${titleLength} > ${this.filters.maxTitleLength})` }
    }

    // 2. URL 检查
    if (this.filters.requireUrl && (!url || !url.trim())) {
      return { valid: false, reason: '缺少URL' }
    }

    if (url) {
      // 3. URL 模式检查
      for (const pattern of this.filters.excludeUrlPatterns) {
        if (pattern.test(url)) {
          return { valid: false, reason: `URL匹配排除模式: ${pattern}` }
        }
      }

      // 4. URL 有效性检查
      try {
        const urlObj = new URL(url)
        // 检查是否是有效的HTTP(S)链接
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return { valid: false, reason: `无效的URL协议: ${urlObj.protocol}` }
        }
      } catch {
        return { valid: false, reason: '无效的URL格式' }
      }
    }

    // 5. 导航关键词检查（只检查完全匹配的短词，避免误杀）
    // 如果标题很短（<=5个字符）且匹配导航模式，则排除
    if (titleLength <= 5) {
      for (const pattern of this.filters.excludeNavPatterns) {
        if (pattern.test(trimmedTitle)) {
          return { valid: false, reason: `标题匹配导航模式: ${pattern}` }
        }
      }
    }

    // 6. 父元素检查
    for (const selector of this.filters.excludeParentSelectors) {
      if ($el.closest(selector).length > 0) {
        return { valid: false, reason: `位于排除的父元素中: ${selector}` }
      }
    }

    return { valid: true }
  }

  /**
   * 异步检查链接是否有实际内容
   * 这是更准确的判断方法
   */
  async isValidArticleWithContent(
    title: string,
    url: string | null | undefined,
    $el: Cheerio<any>
  ): Promise<{ valid: boolean; reason?: string; contentSnippet?: string; hasVideo?: boolean }> {
    // 先进行基本的同步检查
    const syncCheck = this.isValidArticle(title, url, $el)
    if (!syncCheck.valid) {
      return syncCheck
    }

    // 如果没有URL，无法检查内容
    if (!url || !url.trim()) {
      return { valid: false, reason: '缺少URL，无法验证内容' }
    }

    // 检查URL中是否有实际内容
    const contentResult = await this.contentChecker.hasContent(url)

    if (!contentResult.hasContent) {
      return { 
        valid: false, 
        reason: contentResult.reason || '链接中没有找到足够的文字或视频内容' 
      }
    }

    return { 
      valid: true,
      contentSnippet: contentResult.textSnippet,
      hasVideo: contentResult.hasVideo,
    }
  }
}

export class ConfigurableHtmlCrawler implements PlatformCrawler {
  platformId: string
  private config: ConfigurableHtmlCrawlerConfig

  constructor(platformId: string, config: ConfigurableHtmlCrawlerConfig) {
    this.platformId = platformId
    this.config = config
  }

  async crawl(): Promise<CrawlResult> {
    const list = await this.fetchList(this.config.list)
    // 即使列表为空，也返回数据，让调用者决定如何处理
    return {
      success: list.length > 0,
      platformId: this.platformId,
      data: list,
      error: list.length === 0 ? '未获取到数据' : undefined,
    }
  }

  async crawlWithOptions(options?: CrawlOptions): Promise<CrawlResult> {
    if (options?.keywords && options.keywords.length > 0 && this.config.search) {
      const searchList = await this.fetchList(this.config.search, options.keywords)
      return {
        success: searchList.length > 0,
        platformId: this.platformId,
        data: searchList,
        error: searchList.length === 0 ? '未获取到符合条件的结果' : undefined,
      }
    }
    return this.crawl()
  }

  private async fetchList(listConfig: HtmlListConfig, keywords?: string[]): Promise<NewsItem[]> {
    try {
      console.log(`[ConfigurableHtmlCrawler] ========== fetchList START ==========`)
      console.log(`[ConfigurableHtmlCrawler] Platform: ${this.platformId}`)
      console.log(`[ConfigurableHtmlCrawler] List URL: ${listConfig.url}`)
      console.log(`[ConfigurableHtmlCrawler] Item selector: ${listConfig.itemSelector}`)
      
      const requestInit: RequestInit = {
        method: listConfig.method || 'GET',
        headers: listConfig.headers,
      }

      let url = new URL(listConfig.url)

      if (listConfig.params) {
        Object.entries(listConfig.params).forEach(([key, value]) => {
          url.searchParams.set(key, value)
        })
      }

      if (keywords && listConfig.keywordParam) {
        url.searchParams.set(listConfig.keywordParam, keywords.join(' '))
      }

      if (listConfig.body) {
        requestInit.body = listConfig.body
      }

      console.log(`[ConfigurableHtmlCrawler] Fetching HTML from: ${url.toString()}`)
      const html = await fetchHTML(url.toString(), {
        method: requestInit.method,
        headers: {
          ...requestInit.headers,
          'Accept-Charset': 'utf-8,gbk,gb2312',
        },
        body: requestInit.body,
        timeout: 20000,
        proxyFallback: true,
      })
      console.log(`[ConfigurableHtmlCrawler] HTML fetched, length: ${html.length}`)
      
      // fetchHTML 已经处理了编码转换，直接使用
      const $ = HTMLParser.parse(html)
      const items: NewsItem[] = []
      const contentChecker = new ContentChecker(this.config.baseUrl || listConfig.url)
      const filter = new ArticleFilter(listConfig.filters, contentChecker)
      
      console.log(`[ConfigurableHtmlCrawler] Parsing HTML with selector: ${listConfig.itemSelector}`)

      // 第一步：收集所有候选项（通过同步过滤）
      const candidates: Array<{
        title: string
        url: string
        publishedAt?: Date
        $el: Cheerio<any>
      }> = []

      let matchedElements = $(listConfig.itemSelector)
      console.log(`[ConfigurableHtmlCrawler] Found ${matchedElements.length} elements matching selector "${listConfig.itemSelector}"`)
      
      // 如果选择器未匹配到元素，尝试智能回退
      if (matchedElements.length === 0) {
        console.warn(`[ConfigurableHtmlCrawler] No elements found with selector "${listConfig.itemSelector}"`)
        console.log(`[ConfigurableHtmlCrawler] Attempting fallback selectors...`)
        
        // 尝试常见的新闻列表选择器
        // 注意：优先选择容器元素（如 li），而不是链接元素本身（如 a）
        const fallbackSelectors = [
          'li',             // 列表项（容器）
          'article',        // 文章元素
          '.item',          // 通用 item 类
          '.news-item',     // 新闻项
          '.article',       // 文章类
          '[class*="item"]', // 包含 item 的类
          '[class*="news"]', // 包含 news 的类
          '[class*="list"]', // 包含 list 的类
          'div[class*="item"]', // div 中包含 item
          'div[class*="news"]', // div 中包含 news
          'li a',           // 列表项中的链接（最后尝试，需要特殊处理）
        ]
        
        for (const fallbackSelector of fallbackSelectors) {
          const fallbackElements = $(fallbackSelector)
          if (fallbackElements.length > 0) {
            console.log(`[ConfigurableHtmlCrawler] Fallback selector "${fallbackSelector}" found ${fallbackElements.length} elements`)
            // 检查这些元素是否包含链接和标题
            let validCount = 0
            fallbackElements.each((i, el) => {
              const $el = $(el)
              // 如果是 a 元素，检查父元素
              if ($el.is('a')) {
                const $parent = $el.parent()
                const hasText = $parent.text().trim().length > 10
                if (hasText) {
                  validCount++
                }
              } else {
                // 容器元素，检查是否包含链接
                const hasLink = $el.find('a').length > 0
                const hasText = $el.text().trim().length > 10 // 至少10个字符
                if (hasLink && hasText) {
                  validCount++
                }
              }
            })
            
            if (validCount >= 3) { // 至少找到3个有效项
              console.log(`[ConfigurableHtmlCrawler] Using fallback selector "${fallbackSelector}" with ${validCount} valid items`)
              
              // 特殊处理：如果选择器是 "li a"，改为选择父元素 "li"
              if (fallbackSelector === 'li a') {
                const parentElements: any[] = []
                fallbackElements.each((i, el) => {
                  const $el = $(el)
                  if ($el.is('a')) {
                    const $parent = $el.parent('li')
                    if ($parent.length > 0 && !parentElements.includes($parent[0])) {
                      parentElements.push($parent[0])
                    }
                  }
                })
                if (parentElements.length > 0) {
                  matchedElements = $(parentElements)
                  listConfig.itemSelector = 'li'
                  console.log(`[ConfigurableHtmlCrawler] Converted "li a" to "li" container selector`)
                } else {
                  matchedElements = fallbackElements
                  listConfig.itemSelector = fallbackSelector
                }
              } else {
                matchedElements = fallbackElements
                listConfig.itemSelector = fallbackSelector
              }
              break
            }
          }
        }
        
        // 如果回退选择器也失败，输出 HTML 结构分析
        if (matchedElements.length === 0) {
          console.error(`[ConfigurableHtmlCrawler] All selectors failed. Analyzing HTML structure...`)
          
          // 分析 HTML 结构
          const allLinks = $('a[href]')
          const allListItems = $('li')
          const allArticles = $('article')
          const allDivsWithClass = $('div[class]')
          
          console.log(`[ConfigurableHtmlCrawler] HTML Structure Analysis:`)
          console.log(`[ConfigurableHtmlCrawler] - Total links: ${allLinks.length}`)
          console.log(`[ConfigurableHtmlCrawler] - Total list items: ${allListItems.length}`)
          console.log(`[ConfigurableHtmlCrawler] - Total articles: ${allArticles.length}`)
          console.log(`[ConfigurableHtmlCrawler] - Total divs with class: ${allDivsWithClass.length}`)
          
          // 找出最常见的类名
          const classFrequency = new Map<string, number>()
          $('[class]').each((i, el) => {
            const classes = $(el).attr('class')?.split(/\s+/) || []
            classes.forEach(cls => {
              if (cls.length > 0) {
                classFrequency.set(cls, (classFrequency.get(cls) || 0) + 1)
              }
            })
          })
          
          const topClasses = Array.from(classFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
          
          console.log(`[ConfigurableHtmlCrawler] Top 10 class names:`, topClasses.map(([cls, count]) => `${cls} (${count})`).join(', '))
          
          // 尝试使用最常见的包含链接的容器
          for (const [className, count] of topClasses) {
            if (count >= 3) {
              const testSelector = `.${className}`
              const testElements = $(testSelector)
              let validCount = 0
              testElements.each((i, el) => {
                const $el = $(el)
                if ($el.find('a').length > 0 && $el.text().trim().length > 10) {
                  validCount++
                }
              })
              
              if (validCount >= 3) {
                console.log(`[ConfigurableHtmlCrawler] Found potential selector: "${testSelector}" with ${validCount} valid items`)
                matchedElements = testElements
                listConfig.itemSelector = testSelector
                break
              }
            }
          }
          
          // 如果还是找不到，尝试最简单的：所有包含链接的 li 或 div
          if (matchedElements.length === 0) {
            console.log(`[ConfigurableHtmlCrawler] Trying last resort: all list items with links`)
            const allListItemsWithLinks = $('li').filter((i, el) => {
              return $(el).find('a').length > 0 && $(el).text().trim().length > 10
            })
            
            if (allListItemsWithLinks.length > 0) {
              console.log(`[ConfigurableHtmlCrawler] Using last resort selector: "li" with ${allListItemsWithLinks.length} items`)
              matchedElements = allListItemsWithLinks
              listConfig.itemSelector = 'li'
            }
          }
        }
        
        // 如果所有尝试都失败，返回空数组
        if (matchedElements.length === 0) {
          console.error(`[ConfigurableHtmlCrawler] All fallback attempts failed. Cannot find any valid items.`)
          console.log(`[ConfigurableHtmlCrawler] Sample HTML (first 3000 chars):`, html.substring(0, 3000))
          return []
        }
      }

      // 使用最终确定的选择器（可能已被回退逻辑修改）
      const finalSelector = listConfig.itemSelector
      console.log(`[ConfigurableHtmlCrawler] Processing items with selector: "${finalSelector}"`)
      
      $(finalSelector).each((index, element) => {
        const $el = $(element)
        
        // 提取标题 - 如果字段选择器为空或当前元素不匹配，尝试智能提取
        let title = this.getFieldValue($el, listConfig.fields.title)
        
        // 如果标题提取失败，尝试从链接中提取
        if (!title || !title.trim()) {
          const $link = $el.find('a').first()
          if ($link.length > 0) {
            title = $link.text().trim() || $link.attr('title') || ''
          } else if ($el.is('a')) {
            title = $el.text().trim() || $el.attr('title') || ''
          } else {
            // 尝试从元素文本中提取（去除空白）
            title = $el.text().trim()
          }
        }
        
        if (!title || !title.trim()) {
          console.log(`[ConfigurableHtmlCrawler] Skipping item ${index}: no title found`)
          return // 跳过无标题的项
        }

        // 提取URL
        const urlField = listConfig.fields.url
        let link: string | null = null
        
        if (urlField && urlField.selector) {
          link = this.getFieldValue($el, urlField)
        }
        
        // 如果URL提取失败，尝试从链接中提取
        if (!link) {
          const $link = $el.find('a').first()
          if ($link.length > 0) {
            link = $link.attr('href') || null
          } else if ($el.is('a')) {
            link = $el.attr('href') || null
          }
        }

        // 处理相对URL
        if (link && !link.startsWith('http') && this.config.baseUrl) {
          try {
            link = new URL(link, this.config.baseUrl).toString()
          } catch {
            // URL解析失败，跳过此项
            console.warn(`[ConfigurableHtmlCrawler] 无效的URL: ${link}`)
            return
          }
        }

        // 应用同步过滤（快速过滤明显不符合的项）
        const syncFilterResult = filter.isValidArticle(title, link, $el)
        if (!syncFilterResult.valid) {
          console.log(`[ConfigurableHtmlCrawler] 同步过滤项 "${title.substring(0, 50)}...": ${syncFilterResult.reason} (URL: ${link?.substring(0, 50) || 'N/A'})`)
          return // 跳过不符合条件的项
        }
        
        console.log(`[ConfigurableHtmlCrawler] ✓ 通过同步过滤: "${title.substring(0, 50)}..." (URL: ${link?.substring(0, 50) || 'N/A'})`)

        // 提取发布时间
        const publishedAtField = listConfig.fields.publishedAt
        const publishedAt = publishedAtField
          ? this.parseDate(this.getFieldValue($el, publishedAtField))
          : undefined

        candidates.push({
          title: title.trim(),
          url: link || '',
          publishedAt,
          $el,
        })
      })

      console.log(`[ConfigurableHtmlCrawler] Collected ${candidates.length} candidates after sync filtering`)

      // 第二步：对候选项进行异步内容验证
      // 使用并发控制，避免同时检查太多链接
      const CONCURRENT_LIMIT = 5 // 最多同时检查5个链接
      const validItems: NewsItem[] = []

      for (let i = 0; i < candidates.length; i += CONCURRENT_LIMIT) {
        const batch = candidates.slice(i, i + CONCURRENT_LIMIT)
        
        const batchResults = await Promise.all(
          batch.map(async (candidate) => {
            // 检查是否有实际内容
            const contentCheckResult = await filter.isValidArticleWithContent(
              candidate.title,
              candidate.url,
              candidate.$el
            )

            if (!contentCheckResult.valid) {
              console.log(`[ConfigurableHtmlCrawler] 内容验证失败 "${candidate.title}": ${contentCheckResult.reason}`)
              return null
            }
            
            console.log(`[ConfigurableHtmlCrawler] ✓ 内容验证通过: "${candidate.title}"`)

            return {
              title: candidate.title,
              url: candidate.url,
              publishedAt: candidate.publishedAt,
              content: contentCheckResult.contentSnippet,
            } as NewsItem
          })
        )

        // 添加通过验证的项
        for (const result of batchResults) {
          if (result) {
            result.rank = validItems.length + 1
            validItems.push(result)
            // 检查是否达到限制
            if (listConfig.limit && validItems.length >= listConfig.limit) {
              return validItems
            }
          }
        }
      }

      console.log(`[ConfigurableHtmlCrawler] ========== fetchList END ==========`)
      console.log(`[ConfigurableHtmlCrawler] Final valid items: ${validItems.length}`)
      return validItems
    } catch (error) {
      console.error(`[ConfigurableHtmlCrawler] ========== fetchList ERROR ==========`)
      console.error(`[ConfigurableHtmlCrawler] 抓取失败 (${this.platformId}):`, error)
      console.error(`[ConfigurableHtmlCrawler] Error stack:`, error instanceof Error ? error.stack : undefined)
      return []
    }
  }

  private getFieldValue($el: Cheerio<any>, field: HtmlFieldConfig): string | null {
    if (!field) return null
    let target = $el
    if (field.selector) {
      target = $el.find(field.selector).first()
    }

    if (target.length === 0) return null

    let value = field.attribute ? target.attr(field.attribute) : target.text()
    if (!value) return null

    value = value.trim()
    if (field.regex) {
      const match = value.match(new RegExp(field.regex))
      value = match ? match[1] || match[0] : value
    }

    return value
  }

  private parseDate(value?: string | null): Date | undefined {
    if (!value) return undefined
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      return undefined
    }
    return date
  }
}

