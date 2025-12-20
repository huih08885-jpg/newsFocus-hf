/**
 * HTML解析工具类
 * 封装Cheerio的常用操作
 */

import * as cheerio from 'cheerio'

export class HTMLParser {
  /**
   * 解析HTML字符串
   */
  static parse(html: string): cheerio.CheerioAPI {
    return cheerio.load(html)
  }

  /**
   * 提取文本内容
   */
  static extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).text().trim()
  }

  /**
   * 提取属性值
   */
  static extractAttr($: cheerio.CheerioAPI, selector: string, attr: string): string {
    return $(selector).attr(attr) || ''
  }

  /**
   * 提取多个元素的文本
   */
  static extractTexts($: cheerio.CheerioAPI, selector: string): string[] {
    return $(selector)
      .map((i, el) => $(el).text().trim())
      .get()
      .filter(text => text.length > 0)
  }

  /**
   * 提取多个元素的属性
   */
  static extractAttrs($: cheerio.CheerioAPI, selector: string, attr: string): string[] {
    return $(selector)
      .map((i, el) => $(el).attr(attr))
      .get()
      .filter((url): url is string => !!url)
  }

  /**
   * 将相对URL转换为绝对URL
   */
  static resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (!relativeUrl) return ''
    
    // 已经是绝对URL
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl
    }
    
    // 协议相对URL (//example.com)
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`
    }
    
    // 绝对路径 (/path)
    if (relativeUrl.startsWith('/')) {
      try {
        const url = new URL(baseUrl)
        return `${url.origin}${relativeUrl}`
      } catch {
        return relativeUrl
      }
    }
    
    // 相对路径 (path/to)
    try {
      return new URL(relativeUrl, baseUrl).href
    } catch {
      return relativeUrl
    }
  }

  /**
   * 提取新闻列表（通用方法）
   */
  static extractNewsList(
    $: cheerio.CheerioAPI,
    options: {
      itemSelector: string
      titleSelector: string
      urlSelector?: string
      baseUrl?: string
    }
  ): Array<{ title: string; url: string; rank: number }> {
    const items: Array<{ title: string; url: string; rank: number }> = []
    
    $(options.itemSelector).each((i, el) => {
      const $el = $(el)
      const title = $el.find(options.titleSelector).text().trim()
      
      // URL选择器：如果指定了urlSelector，使用它；否则在titleSelector中查找a标签
      let url = ''
      if (options.urlSelector) {
        url = $el.find(options.urlSelector).attr('href') || ''
      } else {
        url = $el.find(options.titleSelector + ' a').attr('href') || ''
      }
      
      if (title && url) {
        // 转换为绝对URL
        if (options.baseUrl) {
          url = this.resolveUrl(options.baseUrl, url)
        }
        
        items.push({
          title,
          url,
          rank: i + 1,
        })
      }
    })
    
    return items
  }

  /**
   * 使用多个备选选择器提取文本（提高稳定性）
   * @param $el cheerio元素或cheerio API
   * @param selectors 备选选择器数组
   */
  static extractTextWithFallback(
    $el: cheerio.CheerioAPI | cheerio.Cheerio<cheerio.Element>,
    selectors: string[]
  ): string {
    for (const selector of selectors) {
      let text = ''
      // 尝试作为元素查找
      if ('find' in $el && typeof ($el as any).find === 'function') {
        text = ($el as cheerio.Cheerio<cheerio.Element>).find(selector).first().text().trim()
      } else {
        // 作为API使用
        text = ($el as cheerio.CheerioAPI)(selector).first().text().trim()
      }
      if (text) {
        return text
      }
    }
    return ''
  }
}

