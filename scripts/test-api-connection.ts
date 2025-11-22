#!/usr/bin/env tsx
/**
 * API 连接测试脚本
 * 用于诊断爬虫 API 连接问题
 */

const API_BASE_URL = process.env.CRAWLER_API_URL || 'https://newsnow.busiyi.world/api/s'

async function testConnection() {
  console.log('='.repeat(60))
  console.log('API 连接诊断工具')
  console.log('='.repeat(60))
  console.log(`API 端点: ${API_BASE_URL}`)
  console.log(`域名: ${new URL(API_BASE_URL).hostname}`)
  console.log('')

  // 测试 1: DNS 解析
  console.log('[测试 1] DNS 解析测试...')
  try {
    const dns = await import('dns')
    const { promisify } = await import('util')
    const lookup = promisify(dns.lookup)
    const hostname = new URL(API_BASE_URL).hostname
    
    try {
      const addresses = await lookup(hostname)
      console.log(`✓ DNS 解析成功: ${hostname} -> ${addresses.address}`)
    } catch (error: any) {
      console.error(`✗ DNS 解析失败: ${error.message}`)
      console.error('  可能原因:')
      console.error('  - 域名不存在')
      console.error('  - DNS 服务器配置问题')
      console.error('  - 网络连接问题')
      return
    }
  } catch (error) {
    console.log('⚠ 无法进行 DNS 测试（可能需要 Node.js 18+）')
  }

  // 测试 2: HTTP 连接
  console.log('\n[测试 2] HTTP 连接测试...')
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(API_BASE_URL + '?id=test&latest', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    console.log(`✓ HTTP 连接成功`)
    console.log(`  状态码: ${response.status} ${response.statusText}`)
    console.log(`  响应头:`, Object.fromEntries(response.headers.entries()))
    
    if (response.ok) {
      try {
        const data = await response.json()
        console.log(`  响应数据:`, JSON.stringify(data).substring(0, 200))
      } catch (e) {
        const text = await response.text()
        console.log(`  响应内容:`, text.substring(0, 200))
      }
    }
  } catch (error: any) {
    console.error(`✗ HTTP 连接失败`)
    
    if (error.name === 'AbortError') {
      console.error('  错误: 连接超时（10秒）')
    } else if (error.message.includes('fetch failed')) {
      console.error(`  错误: ${error.message}`)
      if (error.cause) {
        console.error(`  原因: ${error.cause.code || error.cause.message}`)
      }
    } else {
      console.error(`  错误: ${error.message}`)
    }
    
    console.error('\n可能原因:')
    console.error('  1. API 服务器不可用或已关闭')
    console.error('  2. 防火墙阻止了连接')
    console.error('  3. 网络代理配置问题')
    console.error('  4. SSL/TLS 证书问题')
    console.error('  5. 需要 VPN 或特殊网络环境')
  }

  // 测试 3: 测试特定平台
  console.log('\n[测试 3] 测试特定平台...')
  const testPlatforms = ['zhihu', 'weibo', 'baidu']
  
  for (const platform of testPlatforms) {
    const url = `${API_BASE_URL}?id=${platform}&latest`
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✓ ${platform}: 成功 (状态: ${data.status}, 数据量: ${data.items?.length || 0})`)
      } else {
        console.log(`✗ ${platform}: HTTP ${response.status}`)
      }
    } catch (error: any) {
      console.log(`✗ ${platform}: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('诊断完成')
  console.log('='.repeat(60))
}

testConnection().catch(console.error)

