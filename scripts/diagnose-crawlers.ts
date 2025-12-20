#!/usr/bin/env tsx
/**
 * 爬虫诊断工具
 * 用于诊断为什么爬虫获取不到数据
 */

import { fetchHTML, fetchJSON } from '../lib/utils/fetch-helper'

async function diagnosePlatform(platformId: string, endpoints: Array<{ url: string; type: 'html' | 'json' }>) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`诊断平台: ${platformId}`)
  console.log('='.repeat(80))

  for (const endpoint of endpoints) {
    console.log(`\n尝试端点: ${endpoint.url}`)
    console.log(`类型: ${endpoint.type}`)
    
    try {
      if (endpoint.type === 'html') {
        const html = await fetchHTML(endpoint.url, {
          timeout: 15000,
          retries: 1,
          proxyFallback: true,
        })
        console.log(`✅ 请求成功`)
        console.log(`HTML长度: ${html.length} 字符`)
        console.log(`HTML预览 (前500字符):`)
        console.log(html.substring(0, 500))
        
        // 检查是否包含常见的内容标识
        const hasContent = html.includes('article') || html.includes('news') || html.includes('item') || html.includes('list')
        console.log(`包含内容标识: ${hasContent ? '是' : '否'}`)
      } else {
        const data = await fetchJSON(endpoint.url, {
          timeout: 15000,
          retries: 1,
          proxyFallback: true,
        })
        console.log(`✅ 请求成功`)
        console.log(`数据结构:`)
        console.log(JSON.stringify(data, null, 2).substring(0, 2000))
        
        // 分析数据结构
        console.log(`\n数据结构分析:`)
        if (typeof data === 'object' && data !== null) {
          console.log(`- 根键: ${Object.keys(data).join(', ')}`)
          if ('data' in data) {
            const dataObj = (data as any).data
            if (typeof dataObj === 'object' && dataObj !== null) {
              console.log(`- data键: ${Object.keys(dataObj).join(', ')}`)
              if (Array.isArray(dataObj)) {
                console.log(`- data是数组，长度: ${dataObj.length}`)
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ 请求失败:`)
      console.error(`   错误类型: ${error.name || 'Unknown'}`)
      console.error(`   错误消息: ${error.message || String(error)}`)
      if (error.stack) {
        console.error(`   堆栈: ${error.stack.split('\n').slice(0, 3).join('\n')}`)
      }
    }
  }
}

async function main() {
  console.log('开始诊断爬虫问题...\n')

  // 诊断微博
  await diagnosePlatform('weibo', [
    { url: 'https://weibo.com/ajax/side/hotSearch', type: 'json' },
    { url: 'https://weibo.com/ajax/statuses/hot_band', type: 'json' },
    { url: 'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot', type: 'json' },
  ])

  // 诊断B站
  await diagnosePlatform('bilibili', [
    { url: 'https://api.bilibili.com/x/web-interface/popular', type: 'json' },
    { url: 'https://api.bilibili.com/x/web-interface/popular/series?number=1', type: 'json' },
  ])

  // 诊断百度
  await diagnosePlatform('baidu', [
    { url: 'https://top.baidu.com/api/board?platform=wise&tab=realtime', type: 'json' },
    { url: 'https://top.baidu.com/api/board?platform=pc&tab=realtime', type: 'json' },
  ])

  // 诊断今日头条
  await diagnosePlatform('toutiao', [
    { url: 'https://www.toutiao.com/api/pc/list/feed?category=hot_event&max_behot_time=0', type: 'json' },
  ])

  // 诊断小红书
  await diagnosePlatform('redbook', [
    { url: 'https://edith.xiaohongshu.com/api/sns/web/v1/feed?source=explore_feed', type: 'json' },
  ])

  console.log(`\n${'='.repeat(80)}`)
  console.log('诊断完成')
  console.log('='.repeat(80))
  console.log('\n请查看上面的输出，找出：')
  console.log('1. 哪些端点返回了数据？')
  console.log('2. 返回的数据结构是什么？')
  console.log('3. 是否有认证错误（401/403）？')
  console.log('4. 是否有网络错误？')
}

main().catch(console.error)

