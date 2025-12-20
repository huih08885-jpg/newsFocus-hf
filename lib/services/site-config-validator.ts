import { ConfigurableHtmlCrawler, type ConfigurableHtmlCrawlerConfig } from '@/lib/services/crawlers/configurable-html'
import type { CrawlResult } from '@/lib/services/crawlers/base'

export interface ConfigTestInput {
  config: ConfigurableHtmlCrawlerConfig
  keywords?: string[]
  limit?: number
}

export class SiteConfigValidator {
  async test(input: ConfigTestInput): Promise<CrawlResult> {
    const { config, keywords, limit } = input
    const platformId = `custom-test-${Date.now()}`
    const crawler = new ConfigurableHtmlCrawler(platformId, config)

    if (keywords && keywords.length > 0 && config.search) {
      const result = await crawler.crawlWithOptions({
        keywords,
        mode: 'search',
        limit,
      })
      return result
    }

    return crawler.crawl()
  }
}

