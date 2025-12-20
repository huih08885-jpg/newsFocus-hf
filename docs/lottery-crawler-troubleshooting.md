# 福利彩票爬虫故障排查指南

## 问题：HTTP 403 Forbidden 错误

### 原因分析

中国福利彩票官网 (www.cwl.gov.cn) 可能使用了以下反爬虫机制：

1. **IP 频率限制**：短时间内大量请求会被封禁
2. **User-Agent 检测**：非浏览器 User-Agent 会被拒绝
3. **Cookie/Session 验证**：需要先访问首页获取有效 session
4. **JavaScript 挑战**：可能需要执行 JavaScript 才能获取数据
5. **IP 白名单**：可能只允许特定 IP 访问

### 解决方案

#### 方案 1：改进请求策略（当前已实现）

已实现的改进：
- ✅ 更真实的浏览器 User-Agent
- ✅ 完整的浏览器请求头（Accept, Accept-Language, Sec-Fetch-* 等）
- ✅ 先访问首页获取 cookies
- ✅ 添加 Referer 和 Origin 头
- ✅ 增加请求延迟（2-3秒随机延迟）

#### 方案 2：使用浏览器自动化工具（推荐）

如果方案 1 仍然失败，建议使用 Puppeteer 或 Playwright：

```typescript
import puppeteer from 'puppeteer'

async function crawlWithPuppeteer() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  const page = await browser.newPage()
  
  // 设置真实的浏览器环境
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  
  // 访问页面
  await page.goto('https://www.cwl.gov.cn/ygkj/wqkjgg/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  
  // 等待页面加载
  await page.waitForTimeout(2000)
  
  // 获取页面内容
  const html = await page.content()
  
  await browser.close()
  return html
}
```

#### 方案 3：使用代理服务

如果 IP 被封禁，可以使用代理：

```typescript
const html = await fetchHTML(url, {
  proxyFallback: true, // 启用代理回退
  headers: {
    // ... 其他请求头
  }
})
```

#### 方案 4：使用官方 API（如果存在）

检查网站是否有官方 API 或数据接口：
- 查看浏览器开发者工具的 Network 标签
- 查找 XHR/Fetch 请求
- 查看是否有 JSON 格式的数据接口

#### 方案 5：降低请求频率

如果必须使用当前方法，可以：
- 增加请求间隔（当前为 2-3 秒，可以增加到 5-10 秒）
- 分批爬取（每次只爬取少量数据）
- 在非高峰时段爬取

### 测试步骤

1. **测试首页访问**：
```bash
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
     https://www.cwl.gov.cn/
```

2. **测试目标页面**：
```bash
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
     -H "Referer: https://www.cwl.gov.cn/" \
     https://www.cwl.gov.cn/ygkj/wqkjgg/
```

3. **检查响应头**：
查看服务器返回的响应头，可能包含：
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- 或其他安全相关的头

### 备选数据源

如果官网无法爬取，可以考虑：

1. **第三方数据源**：
   - 彩票数据 API 服务
   - 其他彩票信息网站

2. **手动导入**：
   - 从官网手动下载数据
   - 使用 Excel/CSV 格式导入

3. **定期更新**：
   - 不爬取历史数据，只爬取最新数据
   - 降低被检测的风险

### 注意事项

⚠️ **重要提醒**：
- 遵守网站的 robots.txt 规则
- 不要过度频繁请求，避免对服务器造成压力
- 尊重网站的服务条款
- 考虑使用官方提供的数据接口（如果存在）

### 当前状态

如果仍然遇到 403 错误，建议：
1. 检查网络环境（是否在特定地区/网络）
2. 尝试使用 VPN 或代理
3. 联系网站管理员询问是否有 API 接口
4. 考虑使用浏览器自动化工具（Puppeteer/Playwright）

