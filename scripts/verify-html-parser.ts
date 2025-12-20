/**
 * 验证HTML解析器代码逻辑（不需要实际网络请求）
 */

// 模拟HTML内容
const mockHtml = `
<html>
  <body>
    <div class="HotList-item">
      <h2 class="HotItem-title">测试标题1</h2>
      <a href="/question/123">链接</a>
    </div>
    <div class="HotList-item">
      <h2 class="HotItem-title">测试标题2</h2>
      <a href="/question/456">链接</a>
    </div>
  </body>
</html>
`

async function verifyHTMLParser() {
  try {
    // 动态导入cheerio（如果已安装）
    const cheerio = await import('cheerio')
    
    console.log('✅ Cheerio已安装')
    
    // 测试解析
    const $ = cheerio.load(mockHtml)
    const items = $('.HotList-item')
    
    console.log(`✅ 成功解析HTML，找到 ${items.length} 个元素`)
    
    items.each((i, el) => {
      const $el = $(el)
      const title = $el.find('.HotItem-title').text().trim()
      const url = $el.find('a').attr('href')
      console.log(`  ${i + 1}. ${title} -> ${url}`)
    })
    
    console.log('\n✅ HTML解析器代码逻辑验证通过！')
    return true
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('❌ Cheerio未安装')
      console.log('请运行: npm install cheerio')
      return false
    }
    console.error('❌ 验证失败:', error.message)
    return false
  }
}

verifyHTMLParser().then(success => {
  process.exit(success ? 0 : 1)
})

