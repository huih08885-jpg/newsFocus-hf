# HTML解析功能实现说明

## 概述

已实现优先使用HTML解析、API作为备选的爬虫策略。主要更新了以下平台爬虫：
- 知乎 (Zhihu)
- 微博 (Weibo)  
- 百度 (Baidu)

## 实现原理

### 1. 双重策略
每个爬虫都实现了两种获取方式：
- **HTML解析**（优先）：直接解析网页HTML，提取数据
- **API调用**（备选）：当HTML解析失败时，回退到API方式

### 2. HTML解析工具类 (`lib/utils/html-parser.ts`)
提供了以下功能：
- `parse()`: 解析HTML字符串
- `extractTextWithFallback()`: 使用多个备选选择器提取文本（提高稳定性）
- `resolveUrl()`: 将相对URL转换为绝对URL
- `extractNewsList()`: 提取新闻列表（通用方法）

### 3. 爬虫更新

#### 知乎爬虫 (`lib/services/crawlers/zhihu.ts`)
- **热点模式**: 优先解析 `https://www.zhihu.com/hot`，失败后使用API
- **搜索模式**: 优先解析搜索结果页面，失败后使用搜索API

#### 微博爬虫 (`lib/services/crawlers/weibo.ts`)
- **热点模式**: 优先解析 `https://s.weibo.com/top/summary`，失败后使用API
- **搜索模式**: 使用API（微博搜索主要依赖API）

#### 百度爬虫 (`lib/services/crawlers/baidu.ts`)
- **热点模式**: 优先解析 `https://top.baidu.com/board`，失败后使用API
- **搜索模式**: 主要使用HTML解析（百度搜索本身就是HTML页面）

## 安装依赖

```bash
npm install cheerio
```

如果需要TypeScript类型支持：
```bash
npm install --save-dev @types/cheerio
```

## 测试

运行测试脚本：
```bash
npm run test:crawler:html
```

或者直接运行：
```bash
npx tsx scripts/test-crawler-html.ts
```

## 优势

1. **更高的稳定性**: HTML解析不依赖API变更，即使API失效也能工作
2. **更好的兼容性**: 可以适应不同平台的页面结构变化
3. **自动降级**: HTML解析失败时自动切换到API，保证功能可用
4. **更灵活**: 可以提取API无法提供的数据

## 注意事项

1. **选择器更新**: 如果平台页面结构变化，可能需要更新CSS选择器
2. **反爬虫**: 某些平台可能有反爬虫机制，需要适当设置User-Agent和请求头
3. **性能**: HTML解析需要下载完整页面，可能比API稍慢，但更稳定

## 后续优化建议

1. 添加更多平台的支持
2. 实现选择器自动检测和更新机制
3. 添加HTML解析结果的缓存
4. 实现更智能的选择器匹配算法

