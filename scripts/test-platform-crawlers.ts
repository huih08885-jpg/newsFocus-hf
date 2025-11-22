#!/usr/bin/env tsx
/**
 * 平台爬虫测试脚本
 * 用于测试各个平台的爬虫是否正常工作
 */

import { getCrawler, getRegisteredPlatforms } from '../lib/services/crawlers'

async function testPlatformCrawler(platformId: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试平台: ${platformId}`)
  console.log('='.repeat(60))

  const crawler = getCrawler(platformId)
  
  if (!crawler) {
    console.error(`❌ 平台 ${platformId} 的爬虫未实现`)
    console.log(`已注册的平台: ${getRegisteredPlatforms().join(', ')}`)
    return false
  }

  try {
    console.log(`开始爬取...`)
    const startTime = Date.now()
    
    const result = await crawler.crawl()
    
    const duration = Date.now() - startTime
    
    if (result.success && result.data) {
      console.log(`✅ 爬取成功 (耗时: ${duration}ms)`)
      console.log(`   获取到 ${result.data.length} 条新闻`)
      
      if (result.data.length > 0) {
        console.log(`\n前3条新闻预览:`)
        result.data.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`)
          console.log(`      排名: #${item.rank}`)
          if (item.url) {
            console.log(`      链接: ${item.url.substring(0, 60)}...`)
          }
        })
      }
      
      return true
    } else {
      console.error(`❌ 爬取失败`)
      console.error(`   错误: ${result.error || '未知错误'}`)
      return false
    }
  } catch (error) {
    console.error(`❌ 爬取异常`)
    console.error(`   错误: ${error instanceof Error ? error.message : 'Unknown error'}`)
    if (error instanceof Error && error.stack) {
      console.error(`   堆栈: ${error.stack}`)
    }
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const platformId = args[0]

  console.log('平台爬虫测试工具')
  console.log('='.repeat(60))

  if (platformId) {
    // 测试指定平台
    await testPlatformCrawler(platformId)
  } else {
    // 测试所有已注册的平台
    const registeredPlatforms = getRegisteredPlatforms()
    console.log(`\n已注册的平台: ${registeredPlatforms.join(', ')}`)
    console.log(`\n开始测试所有平台...\n`)

    const results: Array<{ platformId: string; success: boolean }> = []

    for (const platformId of registeredPlatforms) {
      const success = await testPlatformCrawler(platformId)
      results.push({ platformId, success })
      
      // 避免请求过快
      if (platformId !== registeredPlatforms[registeredPlatforms.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // 汇总结果
    console.log(`\n${'='.repeat(60)}`)
    console.log('测试结果汇总')
    console.log('='.repeat(60))
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    console.log(`\n✅ 成功: ${successCount} 个平台`)
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.platformId}`)
    })
    
    console.log(`\n❌ 失败: ${failCount} 个平台`)
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.platformId}`)
    })
  }
}

main().catch(console.error)

