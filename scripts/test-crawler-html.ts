/**
 * 测试爬虫HTML解析功能
 * 运行: npx tsx scripts/test-crawler-html.ts
 */

import { ZhihuCrawler } from '../lib/services/crawlers/zhihu'
import { WeiboCrawler } from '../lib/services/crawlers/weibo'
import { BaiduCrawler } from '../lib/services/crawlers/baidu'

async function testCrawler(name: string, crawler: any, mode: 'hot' | 'search' = 'hot') {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`测试 ${name} - ${mode === 'hot' ? '热点模式' : '搜索模式'}`)
  console.log('='.repeat(50))

  try {
    const startTime = Date.now()
    const result = mode === 'hot' 
      ? await crawler.crawl()
      : await crawler.crawlWithOptions({ 
          mode: 'search', 
          keywords: ['科技', '新闻'],
          limit: 5 
        })
    const duration = Date.now() - startTime

    if (result.success) {
      console.log(`✅ 成功！耗时: ${duration}ms`)
      console.log(`📊 获取到 ${result.data?.length || 0} 条新闻`)
      
      if (result.data && result.data.length > 0) {
        console.log('\n前3条结果:')
        result.data.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`  ${index + 1}. ${item.title}`)
          console.log(`     URL: ${item.url}`)
        })
      }
    } else {
      console.log(`❌ 失败: ${result.error}`)
      console.log(`⏱️  耗时: ${duration}ms`)
    }
  } catch (error) {
    console.error(`❌ 异常:`, error)
  }
}

async function main() {
  console.log('🚀 开始测试爬虫HTML解析功能...\n')

  // 测试热点模式
  await testCrawler('知乎', new ZhihuCrawler(), 'hot')
  await testCrawler('微博', new WeiboCrawler(), 'hot')
  await testCrawler('百度', new BaiduCrawler(), 'hot')

  // 测试搜索模式
  await testCrawler('知乎', new ZhihuCrawler(), 'search')
  await testCrawler('微博', new WeiboCrawler(), 'search')
  await testCrawler('百度', new BaiduCrawler(), 'search')

  console.log(`\n${'='.repeat(50)}`)
  console.log('✅ 测试完成！')
  console.log('='.repeat(50))
}

main().catch(console.error)

