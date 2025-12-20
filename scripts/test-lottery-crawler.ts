/**
 * 测试福利彩票爬虫
 * 运行: npx tsx scripts/test-lottery-crawler.ts
 */

import { LotteryCrawler } from '../lib/services/lottery-crawler'

async function test() {
  console.log('开始测试福利彩票爬虫...\n')

  const crawler = new LotteryCrawler()

  // 测试爬取最近1年的数据（测试用）
  console.log('测试爬取最近1年的数据...')
  const result = await crawler.crawl({
    years: 1, // 测试时只爬1年
    maxPages: 10, // 限制页数
  })

  if (result.success) {
    console.log(`\n✅ 爬取成功！`)
    console.log(`总计: ${result.total} 条开奖结果\n`)

    // 显示前10条结果
    console.log('前10条结果:')
    result.data.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. 期号: ${item.period}`)
      console.log(`   日期: ${item.date}`)
      console.log(`   红球: ${item.redBalls.join(', ')}`)
      console.log(`   蓝球: ${item.blueBall}`)
      if (item.url) {
        console.log(`   URL: ${item.url}`)
      }
      console.log('')
    })

    // 显示统计信息
    const dateRange = result.data.reduce(
      (acc, item) => {
        const date = new Date(item.date)
        if (!acc.min || date < acc.min) acc.min = date
        if (!acc.max || date > acc.max) acc.max = date
        return acc
      },
      { min: null as Date | null, max: null as Date | null }
    )

    if (dateRange.min && dateRange.max) {
      console.log(`日期范围: ${dateRange.min.toISOString().split('T')[0]} 至 ${dateRange.max.toISOString().split('T')[0]}`)
    }
  } else {
    console.error(`\n❌ 爬取失败: ${result.error}`)
  }
}

test().catch(console.error)

