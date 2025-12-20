import { HTMLParser } from '@/lib/utils/html-parser'
import { fetchHTML } from '@/lib/utils/fetch-helper'
import type { ConfigurableHtmlCrawlerConfig } from '@/lib/services/crawlers/configurable-html'
import type { Cheerio, CheerioAPI } from 'cheerio'

const LIST_SELECTOR_CANDIDATES = [
  'article',
  'article.post',
  '.post-item',
  '.news-item',
  '.list-item',
  '.card',
  'li',
  'li.item',
  '.result',
  '.search-result-item',
  '.feed-item',
]

const TITLE_SELECTOR_CANDIDATES = [
  'h1',
  'h2',
  'h3',
  '.title',
  '.post-title',
  '.news-title',
  'a',
]

const DATE_SELECTOR_CANDIDATES = [
  'time',
  '.date',
  '.publish-time',
  '.posted-on',
  '[datetime]',
]

export interface ConfigInferenceResult {
  config: ConfigurableHtmlCrawlerConfig
  stats: {
    itemSelector: string
    titleSelector: string
    urlSelector: string
    samples: Array<{ title: string; url?: string }>
  }
  confidence: number
}

export class ConfigInferenceService {
  async inferFromUrl(url: string): Promise<ConfigInferenceResult> {
    const html = await fetchHTML(url, {
      timeout: 15000,
      proxyFallback: true,
      referer: url,
    })
    const $ = HTMLParser.parse(html)
    const baseUrl = this.getBaseUrl(url)

    const itemSelector = this.detectListSelector($) || 'article, li'
    const samples = this.collectSamples($, itemSelector)

    const titleSelector = samples.titleSelector || 'a'
    const urlSelector = samples.urlSelector || 'a'
    const hasDate = this.detectDateField(samples.items)

    const config: ConfigurableHtmlCrawlerConfig = {
      type: 'html',
      baseUrl,
      list: {
        url,
        itemSelector,
        fields: {
          title: { selector: titleSelector },
          url: { selector: urlSelector, attribute: 'href' },
          ...(hasDate && { publishedAt: { selector: hasDate } }),
        },
        filters: {
          minTitleLength: 4,
        },
      },
    }

    return {
      config,
      stats: {
        itemSelector,
        titleSelector,
        urlSelector,
        samples: samples.items.slice(0, 5),
      },
      confidence: samples.items.length >= 5 ? 0.85 : 0.6,
    }
  }

  private getBaseUrl(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return undefined
    }
  }

  private detectListSelector($: CheerioAPI) {
    for (const selector of LIST_SELECTOR_CANDIDATES) {
      const count = $(selector).length
      if (count >= 5) {
        return selector
      }
    }
    return null
  }

  private collectSamples(
    $: CheerioAPI,
    itemSelector: string
  ) {
    const items: Array<{ title: string; url?: string; element: Cheerio<any> }> = []
    let titleSelector: string | null = null
    let urlSelector: string | null = null

    $(itemSelector).each((_, el) => {
      const $el = $(el)

      const titleData = this.extractTitle($el)
      if (!titleData) return

      if (!titleSelector) titleSelector = titleData.selector
      if (titleData.selector && !urlSelector && titleData.selector === 'a') {
        urlSelector = 'a'
      }

      const link = $el.find('a').attr('href') || undefined
      items.push({
        title: titleData.text,
        url: link,
        element: $el,
      })
    })

    if (!urlSelector) {
      urlSelector = 'a'
    }

    return {
      items,
      titleSelector,
      urlSelector,
    }
  }

  private extractTitle($el: Cheerio<any>) {
    for (const selector of TITLE_SELECTOR_CANDIDATES) {
      const target = selector === 'a' ? $el.find('a').first() : $el.find(selector).first()
      if (target.length === 0) continue
      const text = target.text().trim()
      if (text.length >= 4) {
        return { selector, text }
      }
    }

    const fallback = $el.text().trim()
    if (fallback.length >= 4) {
      return { selector: '', text: fallback }
    }
    return null
  }

  private detectDateField(items: Array<{ element: Cheerio<any> }>) {
    for (const candidate of DATE_SELECTOR_CANDIDATES) {
      let hits = 0
      for (const item of items) {
        const has = item.element.find(candidate).length > 0
        if (has) hits++
      }
      if (hits >= Math.ceil(items.length / 3)) {
        return candidate
      }
    }
    return null
  }
}

