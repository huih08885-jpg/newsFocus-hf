import type { PrismaClient } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { CrawlResult, CrawlOptions, PlatformCrawler } from '@/lib/services/crawlers/base'
import { WeiboCrawler } from '@/lib/services/crawlers/weibo'
import { BilibiliCrawler } from '@/lib/services/crawlers/bilibili'
import { BaiduCrawler } from '@/lib/services/crawlers/baidu'
import { ToutiaoCrawler } from '@/lib/services/crawlers/toutiao'
import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML } from '@/lib/utils/fetch-helper'

export interface UnifiedSearchInput {
  keywords: string[]
  includePlatforms?: string[]
  limitPerPlatform?: number
  searchEngines?: string[]
  page?: number // 分页页码，从1开始
  pageSize?: number // 每页结果数，默认30（10+10+10）
}

export interface UnifiedSearchResult {
  title: string
  url: string
  source: string
  snippet?: string | null
  rank?: number
  platformId?: string
  confidence?: number
  publishedAt?: string | null // 发布时间
  metadata?: Record<string, any>
}

type CrawlerFactory = () => PlatformCrawler

const BUILT_IN_PLATFORM_FACTORIES: Record<string, CrawlerFactory> = {
  weibo: () => new WeiboCrawler(),
  bilibili: () => new BilibiliCrawler(),
  baidu: () => new BaiduCrawler(),
  toutiao: () => new ToutiaoCrawler(),
}

interface SearchEngine {
  id: string
  label: string
  search(query: string, limit: number): Promise<UnifiedSearchResult[]>
}

// 360搜索实现
// 注意：360搜索目前没有公开的通用搜索API
// 360点睛营销开放平台的API主要用于广告投放，不提供搜索查询功能
// 这里尝试使用可能的接口，如果失败则返回空结果
const SO360_SEARCH_ENGINE: SearchEngine = {
  id: 'nano',
  label: '360搜索',
  async search(query, limit) {
    try {
      // 尝试使用360搜索的移动端接口或其他可能的接口
      // 注意：这些接口可能不稳定或需要认证
      
      // 方法1: 尝试使用360点睛营销开放平台的API（需要apiKey和accessToken）
      const apiKey = process.env.SO360_API_KEY
      const accessToken = process.env.SO360_ACCESS_TOKEN
      
      if (apiKey && accessToken) {
        // 360点睛营销开放平台主要用于广告投放，可能不提供搜索查询
        // 这里仅作为示例，实际使用时需要根据官方文档调整
        console.warn('[360Search] 360点睛营销开放平台API主要用于广告投放，不提供搜索查询功能')
      }
      
      // 方法2: 尝试使用360搜索的移动端接口（可能不稳定）
      // 注意：这种方式可能违反360搜索的服务条款，建议谨慎使用
      try {
        const mobileUrl = `https://m.so.com/s?q=${encodeURIComponent(query)}&pn=1&rn=${Math.min(limit, 10)}`
        const response = await fetch(mobileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        })
        
        if (response.ok) {
          const html = await response.text()
          // 解析HTML获取搜索结果（简单实现）
          // 注意：这种方式可能不稳定，因为360搜索的HTML结构可能会变化
          const results: UnifiedSearchResult[] = []
          
          // 使用正则表达式或简单的字符串匹配提取结果
          // 这里仅作为示例，实际应该使用更稳定的解析方法
          const titleRegex = /<h3[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>.*?<\/h3>/gi
          let match
          let count = 0
          
          while ((match = titleRegex.exec(html)) !== null && count < limit) {
            const url = match[1]
            const title = match[2].replace(/<[^>]+>/g, '').trim()
            
            if (url && title && !url.includes('so.com') && url.startsWith('http')) {
              results.push({
                title,
                url,
                source: '360-search',
                snippet: null,
                confidence: 0.70,
              })
              count++
            }
          }
          
          if (results.length > 0) {
            console.log(`[360Search] 查询 "${query}" 找到 ${results.length} 条结果`)
            return results
          }
        }
      } catch (mobileError) {
        console.warn('[360Search] 移动端接口调用失败:', mobileError)
      }
      
      // 如果所有方法都失败，返回空结果
      console.warn('[360Search] 360搜索暂无公开API，无法获取搜索结果')
      return []
    } catch (error) {
      console.error('[360Search] 搜索失败:', error)
      return []
    }
  },
}

const SEARCH_ENGINES: Record<string, SearchEngine> = {
  baidu: {
    id: 'baidu',
    label: '百度搜索',
    async search(query, limit) {
      try {
        // 使用HTML解析方式（不使用API，避免费用）
        // 确保至少获取30条结果，可能需要多页
        const targetLimit = Math.max(limit, 30)
        const results: UnifiedSearchResult[] = []
        const pagesNeeded = Math.ceil(targetLimit / 10) // 每页大约10条
        
        console.log(`[BaiduSearch] 开始搜索 "${query}"，目标获取 ${targetLimit} 条结果，需要 ${pagesNeeded} 页`)
        
        // 逐页获取结果
        for (let page = 0; page < pagesNeeded && results.length < targetLimit; page++) {
          try {
            // 百度搜索URL，使用新闻搜索模式
            const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&tn=news&rtt=1&bsst=1&cl=2&medium=0&pn=${page * 10}`
            
            const html = await fetchHTML(searchUrl, {
              referer: 'https://www.baidu.com/',
              checkRobots: false, // 搜索引擎搜索功能跳过 robots.txt 检查
              timeout: 15000,
              proxyFallback: true,
            })
            
            if (!html || html.length < 1000) {
              console.warn(`[BaiduSearch] 第${page + 1}页获取HTML失败或内容过短`)
              continue
            }
            
            const $ = HTMLParser.parse(html)
            
            // 百度搜索结果的选择器（多种备选）
            const selectors = [
              '.result',
              '.result-op',
              '.c-container',
              '[data-log]',
              'div[class*="result"]',
              'div[class*="c-container"]',
              'div[id*="result"]',
              '.c-result',
              'div[mu]',
            ]
            
            let pageResults: UnifiedSearchResult[] = []
            
            for (const selector of selectors) {
              if (pageResults.length >= 10) break
              
              const elements = $(selector)
              if (elements.length === 0) continue
              
              elements.each((idx, el) => {
                if (pageResults.length >= 10 || results.length >= targetLimit) return false
                const $el = $(el)
                
                // 尝试多种方式获取标题和链接
                let title = $el.find('h3 a').text().trim() || 
                           $el.find('h3').text().trim() ||
                           $el.find('a[href]').first().text().trim() ||
                           $el.find('.t a').text().trim() ||
                           $el.find('[class*="title"] a').text().trim()
                let href = $el.find('h3 a').attr('href') || 
                          $el.find('a[href]').first().attr('href') ||
                          $el.find('.t a').attr('href') ||
                          $el.find('[class*="title"] a').attr('href') || ''
                
                if (!title || !href) return
                
                // 处理百度跳转链接
                if (href.startsWith('/link?url=') || href.startsWith('/link?')) {
                  try {
                    const urlMatch = href.match(/url=([^&]+)/)
                    if (urlMatch) {
                      const decoded = decodeURIComponent(urlMatch[1])
                      if (decoded.startsWith('http')) {
                        href = decoded
                      } else {
                        href = HTMLParser.resolveUrl('https://www.baidu.com', href)
                      }
                    } else {
                      href = HTMLParser.resolveUrl('https://www.baidu.com', href)
                    }
                  } catch {
                    href = HTMLParser.resolveUrl('https://www.baidu.com', href)
                  }
                } else if (!href.startsWith('http')) {
                  href = HTMLParser.resolveUrl('https://www.baidu.com', href)
                }
                
                // 过滤掉百度自己的链接（保留百家号）
                if (href.includes('baidu.com') && !href.includes('baijiahao.baidu.com') && !href.includes('zhidao.baidu.com')) {
                  return
                }
                
                // 过滤掉明显的非新闻链接
                if (href.includes('/search?') || href.includes('/image') || href.includes('/video') || href.includes('/map')) {
                  return
                }
                
                // 获取摘要
                const snippet = $el.find('.c-abstract, .c-span-last, .news-summary, .c-abstract-text, [class*="abstract"]').text().trim()
                
                // 获取发布时间
                // 百度搜索结果的时间通常在摘要开头或特定区域
                let publishedAt: string | null = null
                
                // 方法1: 从摘要文本开头提取时间（如"15小时前1、央视新闻..."或"2024年4月4日3月..."）
                if (snippet) {
                  // 匹配相对时间
                  const relativeTimeMatch = snippet.match(/^(\d{1,2}小时前|\d{1,2}天前|\d{1,2}分钟前)/)
                  if (relativeTimeMatch) {
                    publishedAt = relativeTimeMatch[1]
                  } else {
                    // 匹配绝对日期（如"2024年4月4日"、"2024-11-30"等）
                    const dateMatch = snippet.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}-\d{2}|\d{2}\/\d{2})/)
                    if (dateMatch) {
                      publishedAt = dateMatch[1]
                    }
                  }
                }
                
                // 方法2: 从特定时间选择器提取
                if (!publishedAt) {
                  const timeSelectors = [
                    '.c-color-gray2',
                    '.c-showurl',
                    '.news-time',
                    '.c-time',
                    '[class*="time"]',
                    '[class*="date"]',
                    '.c-gray',
                    '.c-color-gray',
                    '.c-author-time',
                    '.c-span9',
                    '.c-span12',
                  ]
                  
                  for (const timeSel of timeSelectors) {
                    const timeText = $el.find(timeSel).text().trim()
                    if (timeText) {
                      // 提取时间信息（可能是"15小时前"、"2024-11-30"等格式）
                      const timeMatch = timeText.match(/(\d{1,2}小时前|\d{1,2}天前|\d{1,2}分钟前|\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}-\d{2}|\d{2}\/\d{2})/)
                      if (timeMatch) {
                        publishedAt = timeMatch[1]
                        break
                      }
                      // 如果没有匹配到标准格式，但包含时间相关关键词，也记录
                      if (timeText.match(/(小时前|天前|分钟前|刚刚|今天|昨天|前天|\d{4}年)/)) {
                        publishedAt = timeText
                        break
                      }
                    }
                  }
                }
                
                // 方法3: 从整个元素文本中提取（作为最后手段）
                if (!publishedAt) {
                  const allText = $el.text()
                  const timeMatch = allText.match(/(\d{1,2}小时前|\d{1,2}天前|\d{1,2}分钟前|\d{4}年\d{1,2}月\d{1,2}日)/)
                  if (timeMatch) {
                    publishedAt = timeMatch[1]
                  }
                }
                
                // 调试日志：记录提取结果
                if (publishedAt) {
                  console.log(`[BaiduSearch] 提取到发布时间: "${publishedAt}" (标题: ${title.substring(0, 30)}...)`)
                } else {
                  console.log(`[BaiduSearch] 未提取到发布时间 (标题: ${title.substring(0, 30)}..., 摘要前50字符: ${snippet?.substring(0, 50) || '无'}...)`)
                }
                
                // 检查是否已存在
                const exists = results.some(r => r.url === href || (r.title === title && title.length > 10))
                if (exists) return
                
                pageResults.push({
                  title,
                  url: href,
                  source: 'baidu-search',
                  snippet: snippet || null,
                  publishedAt: publishedAt || null,
                  confidence: 0.75,
                })
              })
            }
            
            // 如果选择器方法结果太少，尝试更通用的方法
            if (pageResults.length < 5 && results.length < targetLimit) {
              $('div[id="content_left"], div[class*="content"], div[id*="result"]').find('a[href^="http"]').each((idx, el) => {
                if (pageResults.length >= 10 || results.length >= targetLimit) return false
                const $el = $(el)
                const href = $el.attr('href') || ''
                let title = $el.text().trim()
                
                // 如果标题太短，尝试从父元素获取
                if (title.length < 5) {
                  title = $el.parent().text().trim() || $el.closest('div').find('h3, h2').text().trim()
                }
                
                // 基本过滤
                if (!title || title.length < 5) return
                if (href.includes('baidu.com') && !href.includes('baijiahao.baidu.com')) return
                if (href.includes('/search') || href.includes('/image') || href.includes('/video')) return
                
                // 检查是否已存在
                const exists = results.some(r => r.url === href) || pageResults.some(r => r.url === href)
                if (exists) return
                
                // 尝试提取发布时间（通用方法）
                let publishedAt: string | null = null
                const $parent = $el.parent()
                const timeText = $parent.find('.c-color-gray2, .c-showurl, [class*="time"], [class*="date"]').text().trim()
                if (timeText) {
                  const timeMatch = timeText.match(/(\d{1,2}小时前|\d{1,2}天前|\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2})/)
                  if (timeMatch) {
                    publishedAt = timeMatch[1]
                  } else if (timeText.match(/(小时前|天前|分钟前|刚刚|今天|昨天|前天|\d{4})/)) {
                    publishedAt = timeText
                  }
                }
                
                pageResults.push({
                  title,
                  url: href,
                  source: 'baidu-search',
                  snippet: null,
                  publishedAt: publishedAt || null,
                  confidence: 0.70,
                })
              })
            }
            
            results.push(...pageResults)
            console.log(`[BaiduSearch] 第${page + 1}页获取到 ${pageResults.length} 条结果，累计 ${results.length} 条`)
            
            // 如果当前页结果很少，可能已经到底了，停止翻页
            if (pageResults.length < 3 && page > 0) {
              console.log(`[BaiduSearch] 第${page + 1}页结果太少，停止翻页`)
              break
            }
            
            // 避免请求过快
            if (page < pagesNeeded - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } catch (pageError) {
            console.error(`[BaiduSearch] 第${page + 1}页获取失败:`, pageError)
            continue
          }
        }
        
        console.log(`[BaiduSearch] 查询 "${query}" 通过HTML解析找到 ${results.length} 条结果`)
        return results.slice(0, targetLimit)
      } catch (error) {
        console.error('[BaiduSearch] HTML解析搜索失败:', error)
        return []
      }
    },
  },
  bing: {
    id: 'bing',
    label: 'Bing搜索',
    async search(query, limit) {
      const apiKey = process.env.BING_SEARCH_API_KEY
      const results: UnifiedSearchResult[] = []
      
      // 优先使用 API（如果配置了 API Key）
      if (apiKey) {
        try {
          // 使用通用的 search 端点，支持网页和新闻结果
          const apiUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 50)}&mkt=zh-CN&responseFilter=Webpages,News`
          
          const response = await fetch(apiUrl, {
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            
            // 处理网页结果
            if (data.webPages?.value && Array.isArray(data.webPages.value)) {
              data.webPages.value.slice(0, limit).forEach((item: any, index: number) => {
                if (item.name && item.url) {
                  results.push({
                    title: item.name,
                    url: item.url,
                    source: 'bing-web',
                    snippet: item.snippet || item.description || null,
                    publishedAt: item.dateLastCrawled ? new Date(item.dateLastCrawled).toISOString().split('T')[0] : null,
                    confidence: 0.85,
                  })
                }
              })
            }
            
            // 处理新闻结果（如果网页结果不足）
            if (results.length < limit && data.news?.value && Array.isArray(data.news.value)) {
              data.news.value.slice(0, limit - results.length).forEach((item: any) => {
                if (item.name && item.url && !results.some(r => r.url === item.url)) {
                  results.push({
                    title: item.name,
                    url: item.url,
                    source: 'bing-news',
                    snippet: item.description || null,
                    publishedAt: item.datePublished || null,
                    confidence: 0.85,
                  })
                }
              })
            }
            
            if (results.length > 0) {
              console.log(`[BingSearch] 查询 "${query}" 通过API找到 ${results.length} 条结果`)
              return results.slice(0, limit)
            }
          } else {
            console.warn(`[BingSearch] API调用失败: HTTP ${response.status}，尝试HTML解析`)
          }
        } catch (apiError) {
          console.warn('[BingSearch] API搜索失败，尝试HTML解析:', apiError)
        }
      } else {
        console.log('[BingSearch] 未配置API Key，使用HTML解析')
      }
      
      // 如果 API 失败或未配置，使用 HTML 解析作为备选方案
      try {
        const targetLimit = Math.max(limit, 20)
        const pagesNeeded = Math.ceil(targetLimit / 10) // 每页约10条结果
        
        // 支持多页搜索（类似百度搜索）
        for (let page = 0; page < pagesNeeded && results.length < targetLimit; page++) {
          try {
            const first = page * 10 + 1
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&first=${first}&FORM=PORE`
            
            const html = await fetchHTML(searchUrl, {
              referer: 'https://www.bing.com/',
              checkRobots: false, // 搜索引擎搜索功能跳过 robots.txt 检查
              timeout: 15000,
              proxyFallback: true,
            })
            
            if (!html || html.length < 1000) {
              console.warn(`[BingSearch] 第${page + 1}页HTML解析失败：内容过短或为空`)
              continue
            }
            
            const $ = HTMLParser.parse(html)
            const pageResults: UnifiedSearchResult[] = []
            
            // Bing 搜索结果的选择器（多种备选）
            const selectors = [
              'li.b_algo',
              '.b_algo',
              'ol#b_results > li.b_algo',
              '.b_title',
              'ol#b_results > li',
            ]
            
            for (const selector of selectors) {
              if (pageResults.length >= 10) break
              
              const elements = $(selector)
              if (elements.length === 0) continue
              
              elements.each((idx, el) => {
                if (pageResults.length >= 10 || results.length >= targetLimit) return false
                
                const $el = $(el)
                
                // 获取标题和链接
                let $titleLink = $el.find('h2 a, .b_title a, h2.b_title a').first()
                let title = $titleLink.text().trim()
                let href = $titleLink.attr('href') || ''
                
                // 如果没有找到，尝试其他方式
                if (!title || !href) {
                  const $link = $el.find('a[href^="http"]').first()
                  const linkHref = $link.attr('href') || ''
                  const linkTitle = $link.text().trim()
                  
                  if (linkHref && linkTitle && linkTitle.length > 5) {
                    href = linkHref
                    title = linkTitle
                    $titleLink = $link
                  }
                }
                
                // 过滤无效结果
                if (!title || title.length < 5) return
                if (!href || href.includes('bing.com') || href.includes('/search') || href.includes('/image') || href.includes('/video')) {
                  return
                }
                
                // 获取摘要
                const snippet = $el.find('.b_caption p, .b_caption, .b_snippet, [class*="snippet"], .b_attribution').text().trim()
                
                // 获取发布时间（Bing 通常不显示发布时间，但尝试提取）
                let publishedAt: string | null = null
                const dateText = $el.find('.b_attribution, [class*="date"], [class*="time"], .b_factrow').text().trim()
                if (dateText) {
                  // 匹配多种日期格式
                  const dateMatch = dateText.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}小时前|\d{1,2}天前)/)
                  if (dateMatch) {
                    publishedAt = dateMatch[1]
                  }
                }
                
                // 检查是否已存在
                const exists = results.some(r => r.url === href || (r.title === title && title.length > 10))
                if (exists) return
                if (pageResults.some(r => r.url === href)) return
                
                pageResults.push({
                  title: title || $el.find('a[href^="http"]').first().text().trim(),
                  url: href,
                  source: 'bing-html',
                  snippet: snippet || null,
                  publishedAt: publishedAt || null,
                  confidence: 0.70,
                })
              })
              
              if (pageResults.length > 0) break // 如果找到结果，不再尝试其他选择器
            }
            
            // 如果选择器方法结果太少，尝试更通用的方法
            if (pageResults.length < 5 && results.length < targetLimit) {
              $('ol#b_results, #b_results').find('a[href^="http"]').each((idx, el) => {
                if (pageResults.length >= 10 || results.length >= targetLimit) return false
                
                const $el = $(el)
                const href = $el.attr('href') || ''
                let title = $el.text().trim()
                
                // 如果标题太短，尝试从父元素获取
                if (title.length < 5) {
                  title = $el.parent().text().trim() || $el.closest('li').find('h2').text().trim()
                }
                
                // 基本过滤
                if (!title || title.length < 5) return
                if (href.includes('bing.com') || href.includes('/search') || href.includes('/image') || href.includes('/video')) return
                
                // 检查是否已存在
                const exists = results.some(r => r.url === href) || pageResults.some(r => r.url === href)
                if (exists) return
                
                pageResults.push({
                  title,
                  url: href,
                  source: 'bing-html',
                  snippet: null,
                  publishedAt: null,
                  confidence: 0.65,
                })
              })
            }
            
            results.push(...pageResults)
            console.log(`[BingSearch] 第${page + 1}页获取到 ${pageResults.length} 条结果，累计 ${results.length} 条`)
            
            // 如果当前页结果很少，可能已经到底了，停止翻页
            if (pageResults.length < 3 && page > 0) {
              console.log(`[BingSearch] 第${page + 1}页结果太少，停止翻页`)
              break
            }
            
            // 避免请求过快
            if (page < pagesNeeded - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } catch (pageError) {
            console.error(`[BingSearch] 第${page + 1}页获取失败:`, pageError)
            continue
          }
        }
        
        if (results.length > 0) {
          console.log(`[BingSearch] 查询 "${query}" 通过HTML解析找到 ${results.length} 条结果`)
        }
        
        return results.slice(0, limit)
      } catch (htmlError) {
        console.error('[BingSearch] HTML解析搜索失败:', htmlError)
        return results // 返回 API 结果（如果有）
      }
    },
  },
  nano: SO360_SEARCH_ENGINE,
}

const DEFAULT_SEARCH_ENGINES = ['baidu', 'bing'] // 支持百度（HTML解析）和Bing（API优先，HTML解析备选）

export class SearchOrchestrator {
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * 解析时间字符串为时间戳（用于排序）
   * 支持格式：4小时前、1天前、2024-12-03、2024/12/03等
   */
  private parseTimeToTimestamp(timeStr: string | null | undefined): number {
    if (!timeStr) return 0 // 没有时间的排在最后
    
    const now = Date.now()
    
    // 处理相对时间：X小时前、X天前、X分钟前
    const hourMatch = timeStr.match(/(\d+)小时前/)
    if (hourMatch) {
      const hours = parseInt(hourMatch[1], 10)
      return now - hours * 60 * 60 * 1000
    }
    
    const dayMatch = timeStr.match(/(\d+)天前/)
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10)
      return now - days * 24 * 60 * 60 * 1000
    }
    
    const minuteMatch = timeStr.match(/(\d+)分钟前/)
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1], 10)
      return now - minutes * 60 * 1000
    }
    
    // 处理绝对时间：2024-12-03、2024/12/03
    const dateMatch = timeStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10)
      const month = parseInt(dateMatch[2], 10) - 1 // 月份从0开始
      const day = parseInt(dateMatch[3], 10)
      const date = new Date(year, month, day)
      return date.getTime()
    }
    
    // 如果无法解析，返回0（排在最后）
    return 0
  }

  async unifiedSearch(input: UnifiedSearchInput): Promise<{
    results: UnifiedSearchResult[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
  }> {
    const { 
      keywords, 
      includePlatforms, 
      limitPerPlatform = 10, // 每个搜索引擎每次返回10条
      searchEngines,
      page = 1,
      pageSize = 30, // 每页结果数（默认30条）
    } = input
    
    if (!keywords || keywords.length === 0) {
      throw new Error('keywords is required')
    }

    const query = keywords.join(' ')
    
    // 确定要使用的搜索引擎（默认：百度、Bing）
    const enginesToUse = searchEngines && searchEngines.length > 0 
      ? searchEngines 
      : DEFAULT_SEARCH_ENGINES
    
    const engineList = this.resolveEngines(enginesToUse)
    
    // 计算需要获取的结果数量
    // 分页设置：支持多个搜索引擎（百度、Bing等）
    // 第1页：每个引擎需要10条
    // 第2页：每个引擎需要20条（因为要循环展示）
    // 第N页：每个引擎需要 N * 10 条
    const resultsPerEngine = limitPerPlatform // 每个引擎每轮10条
    const roundsNeeded = page // 需要N轮才能满足第N页的需求
    const neededPerEngine = roundsNeeded * resultsPerEngine
    
    console.log(`[SearchOrchestrator] 第${page}页，每个搜索引擎需要获取 ${neededPerEngine} 条结果`)
    
    // 分别从每个搜索引擎获取结果
    const engineResultsMap: Record<string, UnifiedSearchResult[]> = {}
    
    for (const engine of engineList) {
      try {
        const items = await engine.search(query, neededPerEngine)
        engineResultsMap[engine.id] = items
        console.log(`[SearchOrchestrator] 搜索引擎 ${engine.id} 返回 ${items.length} 条结果`)
      } catch (error) {
        console.warn(`[SearchOrchestrator] 搜索引擎 ${engine.id} 失败:`, error)
        engineResultsMap[engine.id] = []
      }
    }

    // 合并所有引擎的结果（不按轮次交替，直接合并）
    const allResults: UnifiedSearchResult[] = []
    for (const engineId of enginesToUse) {
      const engineResults = engineResultsMap[engineId] || []
      allResults.push(...engineResults)
    }

    // 去重（基于URL）
    const seenUrls = new Set<string>()
    const uniqueResults = allResults.filter(item => {
      if (!item.url) return true // 没有URL的保留
      if (seenUrls.has(item.url)) return false
      seenUrls.add(item.url)
      return true
    })

    // 按发布时间倒序排序（最新的在前）
    const sortedResults = [...uniqueResults].sort((a, b) => {
      const timeA = this.parseTimeToTimestamp(a.publishedAt)
      const timeB = this.parseTimeToTimestamp(b.publishedAt)
      
      // 如果两个都有时间，按时间倒序（最新的在前）
      if (timeA > 0 && timeB > 0) {
        return timeB - timeA
      }
      
      // 如果只有一个有时间，有时间的排在前面
      if (timeA > 0 && timeB === 0) return -1
      if (timeA === 0 && timeB > 0) return 1
      
      // 如果都没有时间，保持原有顺序
      return 0
    })

    // 计算分页
    const startIdx = (page - 1) * pageSize
    const endIdx = startIdx + pageSize
    const paginatedResults = sortedResults.slice(startIdx, endIdx)
    const total = sortedResults.length
    const hasMore = endIdx < total

    console.log(`[SearchOrchestrator] 第${page}页: 显示 ${paginatedResults.length} 条，总共 ${total} 条，还有更多: ${hasMore}`)

    // 保存搜索结果（只保存第一页的结果，避免重复）
    if (page === 1 && paginatedResults.length > 0) {
      await this.persistSearchResults(keywords, paginatedResults)
    }

    return {
      results: paginatedResults,
      total,
      page,
      pageSize,
      hasMore,
    }
  }

  private deduplicateResults(results: UnifiedSearchResult[], limit: number) {
    const seen = new Set<string>()
    const deduped: UnifiedSearchResult[] = []
    for (const item of results) {
      const key = item.url || item.title
      if (!key || seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
      if (deduped.length >= limit) break
    }
    return deduped
  }

  private resolveFactories(include?: string[]) {
    // 只使用传入的平台，如果没有传入则不搜索任何平台
    if (!include || include.length === 0) {
      return []
    }
    return include
      .filter(id => BUILT_IN_PLATFORM_FACTORIES[id])
      .map(id => ({ id, factory: BUILT_IN_PLATFORM_FACTORIES[id] }))
  }

  private resolveEngines(include?: string[]) {
    // 只使用传入的搜索引擎，如果没有传入则不搜索任何引擎
    if (!include || include.length === 0) {
      return []
    }
    return include
      .map((id) => SEARCH_ENGINES[id])
      .filter((engine): engine is SearchEngine => !!engine)
  }

  private async executeCrawler(
    platformId: string,
    crawler: PlatformCrawler,
    options: CrawlOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      let result: CrawlResult
      if (crawler.crawlWithOptions) {
        result = await crawler.crawlWithOptions(options)
      } else {
        result = await crawler.crawl()
      }

      if (!result.success || !result.data) {
        console.warn(`[SearchOrchestrator] ${platformId} 返回空结果或失败:`, result.error)
        return []
      }

      return result.data.map(item => ({
        title: item.title,
        url: item.url || item.mobileUrl || '',
        source: platformId,
        rank: item.rank,
        platformId,
        snippet: item.content,
        confidence: 0.7,
      }))
    } catch (error) {
      console.warn(`[SearchOrchestrator] 平台 ${platformId} 搜索失败：`, error)
      return []
    }
  }

  private async persistSearchResults(keywords: string[], items: UnifiedSearchResult[]) {
    try {
      await this.prisma.searchResult.createMany({
        data: items.map(item => ({
          keywords,
          source: item.source,
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          confidence: item.confidence ?? null,
          metadata: item.metadata || {},
        })),
      })
    } catch (error: any) {
      // 如果表不存在，只记录警告，不影响搜索功能
      if (error?.code === 'P2022' || error?.message?.includes('does not exist')) {
        console.warn('[SearchOrchestrator] search_results 表不存在，跳过保存搜索结果。请执行 SQL 脚本创建表。')
      } else {
        console.error('[SearchOrchestrator] 保存搜索结果失败:', error)
      }
    }
  }
}

