# 开发环境 vs 生产环境爬虫差异分析

## 🔍 问题现象

- ✅ **开发环境**：可以正常爬取目标网站
- ❌ **生产环境（Vercel）**：返回 HTTP 403 Forbidden

## 📊 主要原因分析

### 1. **IP地址差异** ⭐⭐⭐⭐⭐（最可能）

**开发环境**：
- 使用你的本地IP地址（通常是家庭/公司网络）
- IP地址可能是中国境内的，目标网站允许访问

**生产环境（Vercel）**：
- 使用Vercel服务器的IP地址
- Vercel服务器主要部署在**海外**（美国、欧洲等）
- 目标网站 `www.cwl.gov.cn` 可能：
  - 封禁了Vercel的IP段
  - 限制海外IP访问
  - 检测到云服务提供商的IP特征

**验证方法**：
```bash
# 在Vercel服务器上执行（通过日志查看）
curl -I https://www.cwl.gov.cn/
# 如果返回403，说明IP被封禁
```

### 2. **地理位置限制** ⭐⭐⭐⭐

**开发环境**：
- 你的网络位置在中国境内
- 目标网站可能只允许中国境内IP访问

**生产环境**：
- Vercel服务器在海外
- 即使IP没有被封禁，也可能因为地理位置被拒绝

### 3. **User-Agent检测** ⭐⭐⭐

**当前代码**：
```typescript
'User-Agent': 'newsFocus-hf/4.1.0 (+https://github.com/your-repo; contact@example.com) Mozilla/5.0...'
```

**问题**：
- User-Agent中包含项目名称，可能被识别为爬虫
- 开发环境可能使用浏览器直接访问，User-Agent更真实

**建议**：
- 使用更真实的浏览器User-Agent
- 移除项目标识信息

### 4. **请求特征检测** ⭐⭐⭐

**开发环境**：
- 单次请求，间隔较长
- 请求模式更像真实用户

**生产环境**：
- 可能并发请求
- 请求频率可能触发反爬虫机制
- 请求模式可能被识别为自动化工具

### 5. **Cookie/Session差异** ⭐⭐

**开发环境**：
- 可能保留了浏览器的Cookie
- 有完整的Session信息

**生产环境**：
- 无状态环境，没有持久化的Cookie
- 每次请求都是新的Session

### 6. **TLS指纹检测** ⭐⭐

**开发环境**：
- 使用本地浏览器的TLS指纹
- 更接近真实用户

**生产环境**：
- Node.js的TLS指纹可能被识别
- 某些反爬虫系统可以检测TLS指纹

### 7. **请求头完整性** ⭐⭐

**开发环境**：
- 浏览器自动添加完整的请求头
- 包括 `Sec-Fetch-*` 等现代浏览器头

**生产环境**：
- 代码中手动设置的请求头可能不完整
- 缺少某些关键请求头

## 🔧 解决方案

### 方案1：使用代理服务（推荐）⭐⭐⭐⭐⭐

**优点**：
- 可以绕过IP封禁
- 可以使用中国境内的代理IP
- 不影响代码逻辑

**实现**：
```typescript
// 使用代理服务（如：ScraperAPI、Bright Data等）
const proxyUrl = process.env.PROXY_URL
const response = await fetch(url, {
  headers: {...},
  // 通过代理发送请求
})
```

**推荐服务**：
- **ScraperAPI**：专业的爬虫代理服务
- **Bright Data**：企业级代理服务
- **自建代理**：使用中国境内的服务器作为代理

### 方案2：使用Vercel Edge Functions + 中国节点 ⭐⭐⭐

**说明**：
- Vercel Edge Functions 可能部署在更接近目标的位置
- 但Vercel在中国没有节点，效果有限

### 方案3：改进请求头，模拟真实浏览器 ⭐⭐⭐⭐

**实现**：
```typescript
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
  'Referer': 'https://www.cwl.gov.cn/',
  'Origin': 'https://www.cwl.gov.cn/',
}
```

### 方案4：增加延迟和随机化 ⭐⭐⭐

**实现**：
```typescript
// 在请求之间增加随机延迟
const delay = 3000 + Math.random() * 2000 // 3-5秒
await new Promise(resolve => setTimeout(resolve, delay))

// 随机化请求顺序
// 模拟人类行为的不规律性
```

### 方案5：使用Puppeteer（已在代码中，但Vercel不支持）⭐⭐

**问题**：
- Puppeteer需要Chrome浏览器
- Vercel无服务器环境不支持
- 代码中已有检测和回退机制

### 方案6：使用第三方API服务 ⭐⭐⭐⭐⭐

**说明**：
- 如果目标网站提供官方API，直接使用
- 或者使用第三方数据服务
- 避免直接爬取

## 🎯 推荐实施方案

### 短期方案（立即实施）

1. **改进User-Agent**：移除项目标识，使用真实浏览器UA
2. **完善请求头**：添加所有必要的浏览器请求头
3. **增加延迟**：在请求之间增加随机延迟
4. **使用代理服务**：配置代理服务（如ScraperAPI）

### 长期方案

1. **自建代理服务器**：在中国境内部署代理服务器
2. **使用第三方数据服务**：寻找提供彩票数据的API服务
3. **定期更新策略**：根据反爬虫机制的变化调整策略

## 📝 代码改进建议

### 1. 改进User-Agent

```typescript
// lib/utils/fetch-helper.ts
const DEFAULT_HEADERS = {
  // 移除项目标识，使用真实浏览器UA
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // ... 其他头部
}
```

### 2. 添加环境检测

```typescript
// 检测是否在Vercel环境
const isVercel = process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL

if (isVercel) {
  // 生产环境：使用代理或特殊策略
  options.proxyUrl = process.env.PROXY_URL
  options.retries = 5 // 增加重试次数
} else {
  // 开发环境：直接请求
}
```

### 3. 配置代理服务

```typescript
// .env
PROXY_URL=https://api.scraperapi.com?api_key=YOUR_KEY&url=
```

## ⚠️ 注意事项

1. **法律合规**：确保爬虫行为符合目标网站的服务条款
2. **请求频率**：不要过于频繁地请求，避免对目标网站造成压力
3. **数据使用**：合理使用爬取的数据，遵守相关法律法规
4. **成本考虑**：代理服务可能需要付费，需要考虑成本

## 🔍 调试方法

### 1. 查看实际请求头

```typescript
logger.debug('请求头', 'Crawler', { headers: finalHeaders })
```

### 2. 查看响应详情

```typescript
logger.debug('响应详情', 'Crawler', {
  status: response.status,
  statusText: response.statusText,
  headers: Object.fromEntries(response.headers.entries())
})
```

### 3. 对比开发和生产环境的差异

- 记录开发环境的请求头
- 记录生产环境的请求头
- 对比差异

## 📊 总结

**最可能的原因**：
1. **IP地址被封禁**（Vercel海外IP）
2. **地理位置限制**（只允许中国境内访问）
3. **请求特征被识别**（自动化工具特征）

**最佳解决方案**：
1. **使用代理服务**（中国境内IP）
2. **改进请求头**（更真实的浏览器特征）
3. **增加延迟和随机化**（模拟人类行为）

