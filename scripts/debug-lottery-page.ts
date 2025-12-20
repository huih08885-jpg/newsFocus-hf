/**
 * 调试福利彩票页面
 * 用于查看实际的 HTML 结构
 */

import { fetchHTML } from '../lib/utils/fetch-helper'
import { HTMLParser } from '../lib/utils/html-parser'
import * as fs from 'fs'
import * as path from 'path'

async function debug() {
  console.log('开始调试福利彩票页面...\n')

  // 先访问首页获取 cookies
  let cookies = ''
  try {
    console.log('1. 访问首页获取 cookies...')
    const homeResponse = await fetch('https://www.cwl.gov.cn/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    })
    
    const setCookieHeader = homeResponse.headers.get('set-cookie')
    if (setCookieHeader) {
      cookies = Array.isArray(setCookieHeader) 
        ? setCookieHeader.join('; ') 
        : setCookieHeader
      console.log('✓ 获取到 cookies\n')
    }
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 1500))
  } catch (error) {
    console.warn('获取 cookies 失败，继续尝试:', error)
  }

  const url = 'https://www.cwl.gov.cn/ygkj/wqkjgg/'

  try {
    console.log('2. 访问目标页面...')
    // 获取 HTML，使用完整的浏览器请求头
    const customHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    }

    if (cookies) {
      customHeaders['Cookie'] = cookies
    }

    const html = await fetchHTML(url, {
      timeout: 20000,
      retries: 3,
      checkRobots: false,
      referer: 'https://www.cwl.gov.cn/',
      origin: 'https://www.cwl.gov.cn',
      headers: customHeaders,
    })

    console.log(`HTML 长度: ${html.length}\n`)

    // 保存完整 HTML 到文件
    const htmlPath = path.join(__dirname, '../debug-lottery-page.html')
    fs.writeFileSync(htmlPath, html, 'utf-8')
    console.log(`完整 HTML 已保存到: ${htmlPath}\n`)

    const $ = HTMLParser.parse(html)

    // 分析表格
    console.log('=== 表格分析 ===')
    $('table').each((i, table) => {
      const $table = $(table)
      const rows = $table.find('tr')
      console.log(`\n表格 ${i + 1}:`)
      console.log(`  行数: ${rows.length}`)
      
      rows.each((j, row) => {
        const $row = $(row)
        const cells = $row.find('td, th')
        const rowText = $row.text().trim()
        console.log(`\n  行 ${j + 1} (${cells.length} 列):`)
        console.log(`    文本: ${rowText.substring(0, 200)}`)
        cells.each((k, cell) => {
          const cellText = $(cell).text().trim()
          if (cellText) {
            console.log(`    列 ${k + 1}: ${cellText.substring(0, 100)}`)
          }
        })
      })
    })

    // 查找可能的 AJAX 请求
    console.log('\n=== 查找 AJAX 请求 ===')
    const scripts = $('script').toArray()
    scripts.forEach((script, i) => {
      const scriptText = $(script).html() || ''
      if (scriptText.includes('ajax') || scriptText.includes('fetch') || scriptText.includes('XMLHttpRequest')) {
        console.log(`\n脚本 ${i + 1} 可能包含 AJAX:`)
        // 查找 URL
        const urlMatches = scriptText.match(/['"](https?:\/\/[^'"]+)['"]/gi)
        if (urlMatches) {
          console.log(`  可能的 URL: ${urlMatches.slice(0, 5).join(', ')}`)
        }
        // 查找包含 /ygkj/ 或 /wqkjgg/ 的 URL
        const kjMatches = scriptText.match(/['"]([^'"]*\/ygkj\/[^'"]*|[^'"]*\/wqkjgg\/[^'"]*)['"]/gi)
        if (kjMatches) {
          console.log(`  开奖相关 URL: ${kjMatches.slice(0, 5).join(', ')}`)
        }
      }
    })

    // 查找所有链接
    console.log('\n=== 查找相关链接 ===')
    $('a[href*="ygkj"], a[href*="wqkjgg"], a[href*="kj"]').each((i, link) => {
      const href = $(link).attr('href')
      const text = $(link).text().trim()
      if (href && text) {
        console.log(`链接 ${i + 1}: ${text} -> ${href}`)
      }
    })

    // 查找包含期号的文本
    console.log('\n=== 查找期号 ===')
    const bodyText = $('body').text()
    const periodMatches = bodyText.match(/\d{4,7}期/g)
    if (periodMatches) {
      console.log(`找到 ${periodMatches.length} 个期号:`)
      console.log(periodMatches.slice(0, 10).join(', '))
    } else {
      console.log('未找到期号，数据可能是动态加载的')
    }

  } catch (error) {
    console.error('调试失败:', error)
  }
}

debug().catch(console.error)

