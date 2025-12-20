import { HTMLParser } from '@/lib/utils/html-parser'
import type { Cheerio, CheerioAPI, AnyNode } from 'cheerio'

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

const MIN_CONTENT_LENGTH = 80

export interface ArticleExtraction {
  content: string | null
  publishedAt: Date | null
}

/**
 * 通用文章内容提取器
 * 在保存新闻时将正文内容抓取下来
 */
export class ArticleContentExtractor {
  private cache = new Map<string, ArticleExtraction>()

  async extract(url?: string): Promise<ArticleExtraction | null> {
    if (!url) return null
    if (this.cache.has(url)) {
      return this.cache.get(url)!
    }

    try {
      const response = await fetch(url, {
        headers: DEFAULT_HEADERS,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      const $ = HTMLParser.parse(html)

      // 移除无关标签
      $('script, style, noscript, iframe').remove()

      let content: string | null = null
      for (const selector of CONTENT_SELECTORS) {
        const candidate = $(selector)
        if (candidate.length === 0) continue

        const structuredText = this.extractStructuredText(candidate, $)
        if (structuredText && structuredText.length >= MIN_CONTENT_LENGTH) {
          content = structuredText
          break
        }
      }

      if (!content) {
        const bodyText = this.normalizeText($('body').text(), true)
        if (bodyText.length >= MIN_CONTENT_LENGTH / 2) {
          content = bodyText
        }
      }

      const publishedAt = this.extractPublishedTime($)

      if (content || publishedAt) {
        const extraction = { content, publishedAt }
        this.cache.set(url, extraction)
        return extraction
      }
    } catch (error) {
      console.warn(`[ArticleContent] 提取失败: ${url}`, error)
    }

    return null
  }

  private extractStructuredText($container: Cheerio<AnyNode>, $: CheerioAPI): string | null {
    const blocks = $container
      .find('p, li, h1, h2, h3, h4, blockquote')
      .toArray()
      .map(node => this.normalizeText($(node).text()))
      .filter(Boolean)

    if (blocks.length > 0) {
      return blocks.join('\n\n')
    }

    const text = this.normalizeText($container.text(), true)
    return text || null
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

  private extractPublishedTime($: CheerioAPI): Date | null {
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish-date"]',
      'meta[name="pubdate"]',
      'meta[name="publishDate"]',
      'meta[name="publish_time"]',
      'meta[name="date"]',
      'meta[itemprop="datePublished"]',
      '[itemprop="datePublished"]',
    ]

    for (const selector of metaSelectors) {
      const content = $(selector).attr('content')
      const datetime = this.parseDateTime(content)
      if (datetime) return datetime
    }

    const timeSelectors = [
      'time[datetime]',
      '.pubtime',
      '.publish-time',
      '.article-time',
      '.time',
      '.date',
      '.post-time',
    ]

    for (const selector of timeSelectors) {
      const el = $(selector).first()
      if (el.length === 0) continue

      const datetimeAttr = el.attr('datetime')
      const datetime = this.parseDateTime(datetimeAttr || el.text())
      if (datetime) return datetime
    }

    return null
  }

  private parseDateTime(raw?: string | null): Date | null {
    if (!raw) return null
    let value = raw.trim()
    if (!value) return null

    if (/^\d{10,13}$/.test(value)) {
      const timestamp = value.length === 13 ? Number(value) : Number(value) * 1000
      const date = new Date(timestamp)
      return isNaN(date.getTime()) ? null : date
    }

    let normalized = value
      .replace(/年|\/|\./g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, ' ')
      .replace(/--+/g, '-')
      .replace(/时/g, ':')
      .replace(/分/g, ':')
      .replace(/秒/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      normalized = `${normalized} 00:00:00`
    }

    if (!normalized.includes('T') && /\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T')
    }

    const date = new Date(normalized)
    return isNaN(date.getTime()) ? null : date
  }
}

