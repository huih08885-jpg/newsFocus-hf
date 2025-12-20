/**
 * 平台爬虫注册表
 * 在这里注册所有平台的爬虫实现
 */

import { PlatformCrawler } from './base'
import { ZhihuCrawler } from './zhihu'
import { WeiboCrawler } from './weibo'
import { BaiduCrawler } from './baidu'
import { BilibiliCrawler } from './bilibili'
import { DouyinCrawler } from './douyin'
import { ToutiaoCrawler } from './toutiao'
import { NeteaseCrawler } from './netease'
import { SinaCrawler } from './sina'
import { QQCrawler } from './qq'
import { RedbookCrawler } from './redbook'
import { WebSearchCrawler } from './web-search'

// 平台爬虫映射表
const crawlers: Map<string, () => PlatformCrawler> = new Map([
  ['zhihu', () => new ZhihuCrawler()],
  ['weibo', () => new WeiboCrawler()],
  ['baidu', () => new BaiduCrawler()],
  ['bilibili', () => new BilibiliCrawler()],
  ['douyin', () => new DouyinCrawler()],
  ['toutiao', () => new ToutiaoCrawler()],
  ['netease', () => new NeteaseCrawler()],
  ['sina', () => new SinaCrawler()],
  ['qq', () => new QQCrawler()],
  ['redbook', () => new RedbookCrawler()],
  ['web-search', () => new WebSearchCrawler()], // 全网搜索爬虫
  // 其他平台的爬虫可以在这里添加
])

/**
 * 获取指定平台的爬虫实例
 */
export function getCrawler(platformId: string): PlatformCrawler | null {
  const factory = crawlers.get(platformId)
  return factory ? factory() : null
}

/**
 * 获取所有已注册的平台ID列表
 */
export function getRegisteredPlatforms(): string[] {
  return Array.from(crawlers.keys())
}

/**
 * 注册新的平台爬虫
 */
export function registerCrawler(platformId: string, factory: () => PlatformCrawler): void {
  crawlers.set(platformId, factory)
}

