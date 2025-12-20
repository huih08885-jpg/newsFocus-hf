# HTML解析技术详解 - Cheerio使用指南

## 什么是HTML解析？

HTML解析是指从HTML文档中提取结构化数据的技术。它不需要执行JavaScript，直接解析HTML源码，速度快、资源消耗低。

## Cheerio 简介

**Cheerio** 是Node.js中最流行的HTML解析库，它：
- 实现了jQuery的核心功能
- 在服务器端解析HTML
- 速度快、内存占用低
- API与jQuery API完全兼容

## 工作原理

```
1. 获取HTML源码（通过fetch）
   ↓
2. 加载到Cheerio（解析DOM）
   ↓
3. 使用jQuery选择器提取数据
   ↓
4. 转换为结构化数据
```

## 技术对比

### API解析 vs HTML解析

| 特性 | API解析（当前） | HTML解析（Cheerio） |
|------|----------------|-------------------|
| **速度** | ⚡⚡⚡⚡⚡ 极快 | ⚡⚡⚡⚡ 快 |
| **资源消耗** | 💚 极低 | 💚 低 |
| **稳定性** | ⚠️ 依赖API稳定性 | ✅ 相对稳定 |
| **灵活性** | ❌ 受限于API | ✅ 可以提取任意数据 |
| **实现复杂度** | ✅ 简单 | ⚠️ 中等 |
| **维护成本** | ⚠️ API变更需更新 | ⚠️ HTML结构变更需更新 |

## 适用场景

### ✅ 适合使用HTML解析的场景

1. **没有公开API的网站**
   - 只能通过HTML获取数据
   - 例如：某些新闻网站、博客

2. **API不稳定或经常变更**
   - HTML结构相对稳定
   - 作为API的备选方案

3. **需要提取的数据不在API中**
   - API返回的数据不完整
   - HTML中有更多信息

4. **静态HTML页面**
   - 不需要JavaScript渲染
   - 数据直接在HTML中

### ❌ 不适合使用HTML解析的场景

1. **需要JavaScript渲染的SPA**
   - 数据通过AJAX动态加载
   - 需要使用Puppeteer/Playwright

2. **有公开且稳定的API**
   - API更快、更可靠
   - 优先使用API

3. **HTML结构频繁变更**
   - 维护成本高
   - 选择器容易失效

## Cheerio 基础用法

### 1. 安装

```bash
npm install cheerio
npm install --save-dev @types/cheerio
```

### 2. 基本使用

```typescript
import * as cheerio from 'cheerio'

// 1. 获取HTML
const html = await fetch('https://example.com').then(r => r.text())

// 2. 加载到Cheerio
const $ = cheerio.load(html)

// 3. 使用jQuery选择器提取数据
const title = $('h1').text()
const links = $('a').map((i, el) => $(el).attr('href')).get()
```

### 3. 常用选择器

```typescript
// 类选择器
$('.news-item')

// ID选择器
$('#main-content')

// 标签选择器
$('div', 'article', 'a')

// 属性选择器
$('[data-id="123"]')
$('a[href*="news"]')  // href包含"news"

// 组合选择器
$('.news-list .item')
$('div.news-item > a.title')

// 伪类选择器
$('li:first-child')
$('tr:nth-child(2)')
```

### 4. 数据提取示例

```typescript
// 提取文本
const text = $('.title').text()  // 所有文本（包括子元素）
const textOnly = $('.title').text().trim()  // 去除空白

// 提取HTML
const html = $('.content').html()

// 提取属性
const href = $('a').attr('href')
const src = $('img').attr('src')
const dataId = $('.item').attr('data-id')

// 提取多个元素
const titles = $('.news-title').map((i, el) => $(el).text()).get()

// 遍历元素
$('.news-item').each((i, el) => {
  const title = $(el).find('.title').text()
  const url = $(el).find('a').attr('href')
  console.log({ title, url })
})
```

## 实际应用示例

### 示例1：解析新闻列表

```typescript
import * as cheerio from 'cheerio'

async function parseNewsList(html: string) {
  const $ = cheerio.load(html)
  const newsItems = []

  // 假设HTML结构：
  // <div class="news-list">
  //   <div class="news-item">
  //     <h3 class="title"><a href="/news/1">标题</a></h3>
  //     <span class="time">2024-01-01</span>
  //   </div>
  // </div>

  $('.news-item').each((i, el) => {
    const $el = $(el)
    newsItems.push({
      title: $el.find('.title a').text().trim(),
      url: $el.find('.title a').attr('href'),
      time: $el.find('.time').text().trim(),
      rank: i + 1,
    })
  })

  return newsItems
}
```

### 示例2：处理复杂结构

```typescript
async function parseComplexPage(html: string) {
  const $ = cheerio.load(html)
  
  // 提取主标题
  const mainTitle = $('h1.article-title').text().trim()
  
  // 提取作者信息
  const author = {
    name: $('.author-name').text().trim(),
    avatar: $('.author-avatar img').attr('src'),
  }
  
  // 提取正文内容
  const content = $('.article-content').html() || ''
  
  // 提取相关链接
  const relatedLinks = $('.related-articles a')
    .map((i, el) => ({
      title: $(el).text().trim(),
      url: $(el).attr('href'),
    }))
    .get()
  
  return {
    title: mainTitle,
    author,
    content,
    relatedLinks,
  }
}
```

### 示例3：处理表格数据

```typescript
async function parseTable(html: string) {
  const $ = cheerio.load(html)
  const rows = []

  // 解析表格
  $('table tbody tr').each((i, el) => {
    const $row = $(el)
    rows.push({
      rank: $row.find('td:first-child').text().trim(),
      title: $row.find('td:nth-child(2)').text().trim(),
      count: $row.find('td:last-child').text().trim(),
    })
  })

  return rows
}
```

## 在当前项目中集成

### 方案1：作为API的备选方案

```typescript
// lib/services/crawlers/zhihu-html.ts
import * as cheerio from 'cheerio'
import { PlatformCrawler, CrawlResult, NewsItem } from './base'

export class ZhihuHTMLCrawler implements PlatformCrawler {
  platformId = 'zhihu-html'

  async crawl(): Promise<CrawlResult> {
    try {
      // 1. 获取HTML
      const html = await fetch('https://www.zhihu.com/hot', {
        headers: {
          'User-Agent': 'Mozilla/5.0...',
        },
      }).then(r => r.text())

      // 2. 解析HTML
      const $ = cheerio.load(html)
      const items: NewsItem[] = []

      // 3. 提取数据（根据实际HTML结构调整选择器）
      $('.HotList-item').each((i, el) => {
        const $el = $(el)
        const title = $el.find('.HotItem-title').text().trim()
        const url = $el.find('a').attr('href')
        
        if (title && url) {
          items.push({
            title,
            url: url.startsWith('http') ? url : `https://www.zhihu.com${url}`,
            rank: i + 1,
          })
        }
      })

      return {
        success: true,
        platformId: this.platformId,
        data: items,
      }
    } catch (error) {
      return {
        success: false,
        platformId: this.platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
```

### 方案2：混合策略（API优先，HTML备选）

```typescript
// lib/services/crawlers/zhihu.ts (增强版)
import * as cheerio from 'cheerio'

export class ZhihuCrawler implements PlatformCrawler {
  async crawlHotList(limit: number = 10): Promise<CrawlResult> {
    try {
      // 1. 优先尝试API
      const apiResult = await this.crawlHotListAPI(limit)
      if (apiResult.success) {
        return apiResult
      }

      // 2. API失败时，使用HTML解析作为备选
      console.log('[Zhihu] API失败，尝试HTML解析...')
      return await this.crawlHotListHTML(limit)
    } catch (error) {
      return {
        success: false,
        platformId: this.platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async crawlHotListAPI(limit: number): Promise<CrawlResult> {
    // 现有的API爬取逻辑
    // ...
  }

  private async crawlHotListHTML(limit: number): Promise<CrawlResult> {
    const html = await fetch('https://www.zhihu.com/hot', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }).then(r => r.text())

    const $ = cheerio.load(html)
    const items: NewsItem[] = []

    $('.HotList-item').each((i, el) => {
      if (i >= limit) return false // 停止遍历
      
      const $el = $(el)
      const title = $el.find('.HotItem-title').text().trim()
      const url = $el.find('a').attr('href')
      
      if (title && url) {
        items.push({
          title,
          url: url.startsWith('http') ? url : `https://www.zhihu.com${url}`,
          rank: i + 1,
        })
      }
    })

    return {
      success: items.length > 0,
      platformId: this.platformId,
      data: items,
    }
  }
}
```

## 最佳实践

### 1. 错误处理

```typescript
try {
  const html = await fetch(url).then(r => r.text())
  const $ = cheerio.load(html)
  
  // 检查元素是否存在
  if ($('.news-list').length === 0) {
    throw new Error('页面结构已变更，无法找到新闻列表')
  }
  
  // 提取数据
  const items = $('.news-item').map(...).get()
  
  if (items.length === 0) {
    console.warn('未提取到任何数据')
  }
  
  return items
} catch (error) {
  console.error('HTML解析失败:', error)
  throw error
}
```

### 2. 选择器稳定性

```typescript
// ❌ 不好的选择器（太具体，容易失效）
$('.container > div > div:nth-child(2) > .item')

// ✅ 好的选择器（使用语义化类名）
$('.news-item')
$('[data-news-id]')

// ✅ 使用多个备选选择器
const title = $('.title, .news-title, h2').first().text()
```

### 3. 数据验证

```typescript
function extractNewsItem($el: cheerio.Cheerio): NewsItem | null {
  const title = $el.find('.title').text().trim()
  const url = $el.find('a').attr('href')
  
  // 验证必需字段
  if (!title || !url) {
    return null
  }
  
  // 验证URL格式
  if (!url.startsWith('http') && !url.startsWith('/')) {
    return null
  }
  
  return {
    title,
    url: url.startsWith('http') ? url : `https://example.com${url}`,
    rank: 0, // 稍后设置
  }
}
```

### 4. 性能优化

```typescript
// ✅ 使用更具体的选择器，减少遍历
$('.news-list .item')  // 而不是 $('.item')

// ✅ 限制提取数量
$('.news-item').slice(0, 20).each(...)

// ✅ 缓存解析结果
const $ = cheerio.load(html)
const title = $('.title').text()  // 复用同一个$对象
const content = $('.content').text()
```

## 常见问题处理

### 1. HTML结构变更

```typescript
// 使用多个备选选择器
function extractTitle($: cheerio.Cheerio): string {
  return (
    $('.title').text() ||
    $('.news-title').text() ||
    $('h2').text() ||
    $('[data-title]').attr('data-title') ||
    ''
  ).trim()
}
```

### 2. 编码问题

```typescript
// 确保正确处理编码
const response = await fetch(url)
const buffer = await response.arrayBuffer()
const html = new TextDecoder('utf-8').decode(buffer)
const $ = cheerio.load(html)
```

### 3. 相对URL转绝对URL

```typescript
function resolveUrl(baseUrl: string, relativeUrl: string): string {
  if (relativeUrl.startsWith('http')) {
    return relativeUrl
  }
  if (relativeUrl.startsWith('//')) {
    return `https:${relativeUrl}`
  }
  if (relativeUrl.startsWith('/')) {
    const url = new URL(baseUrl)
    return `${url.origin}${relativeUrl}`
  }
  // 相对路径
  return new URL(relativeUrl, baseUrl).href
}
```

## 与当前项目的集成建议

### 阶段1：添加HTML解析能力（推荐）

1. **安装Cheerio**
   ```bash
   npm install cheerio
   npm install --save-dev @types/cheerio
   ```

2. **创建HTML解析工具类**
   ```typescript
   // lib/utils/html-parser.ts
   import * as cheerio from 'cheerio'
   
   export class HTMLParser {
     static parse(html: string) {
       return cheerio.load(html)
     }
     
     static extractText($: cheerio.Cheerio, selector: string): string {
       return $(selector).text().trim()
     }
     
     static extractAttr($: cheerio.Cheerio, selector: string, attr: string): string {
       return $(selector).attr(attr) || ''
     }
   }
   ```

3. **在爬虫中添加HTML解析备选方案**
   - API失败时自动切换到HTML解析
   - 提高系统稳定性

### 阶段2：创建纯HTML解析的爬虫

对于没有API的平台，直接使用HTML解析：
- 某些新闻网站
- 博客平台
- 论坛

## 总结

### HTML解析的优势

1. ✅ **速度快**：比浏览器自动化快10-100倍
2. ✅ **资源消耗低**：内存占用小
3. ✅ **灵活性高**：可以提取任意数据
4. ✅ **稳定性好**：不依赖API

### HTML解析的劣势

1. ❌ **无法处理JavaScript渲染的内容**
2. ❌ **HTML结构变更需要更新选择器**
3. ❌ **需要处理各种HTML格式**

### 推荐策略

**混合使用**：
1. 优先使用API（如果可用）
2. API失败时使用HTML解析
3. 需要JavaScript时使用浏览器自动化

这样可以兼顾速度、稳定性和灵活性！

