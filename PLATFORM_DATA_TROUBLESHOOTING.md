# 平台数据问题排查指南

## 问题：某些平台显示"暂无数据"

### 原因分析

平台显示"暂无数据"可能有以下几个原因：

1. **爬虫未实现** ❌
   - 平台在数据库中，但没有对应的爬虫实现
   - 解决方案：实现该平台的爬虫（参考 `lib/services/crawlers/README.md`）

2. **爬虫已实现但未注册** ⚠️
   - 爬虫文件存在，但没有在 `lib/services/crawlers/index.ts` 中注册
   - 解决方案：在注册表中添加该平台

3. **爬取失败** ❌
   - API 端点不可用或已变更
   - 网络连接问题
   - API 返回格式变化
   - 解决方案：检查 API 端点，更新爬虫实现

4. **数据库中没有数据** 📊
   - 爬取成功但数据未保存
   - 从未运行过爬取任务
   - 解决方案：运行爬取任务

5. **平台被禁用** 🔒
   - 数据库中平台的 `enabled` 字段为 `false`
   - 解决方案：在数据库中启用该平台

## 排查步骤

### 步骤 1: 检查爬虫是否已实现

```bash
# 查看已注册的平台
pnpm test:crawler

# 或查看代码
cat lib/services/crawlers/index.ts
```

### 步骤 2: 测试单个平台的爬虫

```bash
# 测试指定平台（例如：知乎）
pnpm test:crawler zhihu

# 测试其他平台
pnpm test:crawler weibo
pnpm test:crawler toutiao
pnpm test:crawler netease
pnpm test:crawler sina
pnpm test:crawler qq
```

### 步骤 3: 检查数据库中的数据

```bash
# 使用 Prisma Studio 查看数据库
pnpm db:studio
```

在 Prisma Studio 中：
1. 打开 `Platform` 表，检查平台是否存在且 `enabled = true`
2. 打开 `NewsItem` 表，检查是否有该平台的数据
3. 检查 `CrawlTask` 表，查看最近的爬取任务状态

### 步骤 4: 运行爬取任务

1. 在 Web 界面点击"立即爬取"
2. 查看爬取进度对话框中的错误信息
3. 检查控制台日志

### 步骤 5: 检查 API 端点

如果爬取失败，可能是 API 端点不可用。可以手动测试：

```bash
# 测试知乎 API
curl "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true"

# 测试微博 API
curl "https://weibo.com/ajax/side/hotSearch"

# 测试今日头条 API
curl "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
```

## 当前平台状态

### ✅ 已实现并注册的平台

- zhihu (知乎)
- weibo (微博)
- baidu (百度)
- bilibili (B站)
- douyin (抖音)
- toutiao (今日头条)
- netease (网易)
- sina (新浪)
- qq (腾讯)

### ⚠️ 已实现但可能需要调整的平台

- **redbook (小红书)**: 暂无公开 API，返回错误信息

### 📝 待实现的平台

- douban (豆瓣)

## 常见问题解决

### Q1: 知乎显示"暂无数据"

**可能原因**:
- 知乎 API 可能需要 Cookie 或特殊请求头
- API 端点可能已变更

**解决方案**:
1. 测试知乎 API 是否可访问
2. 检查是否需要添加 Cookie
3. 查看控制台错误日志

### Q2: 微博显示"暂无数据"

**可能原因**:
- 微博 API 可能需要登录
- API 返回格式可能已变化

**解决方案**:
1. 检查 API 响应格式
2. 可能需要使用移动端 API

### Q3: 今日头条显示"暂无数据"

**可能原因**:
- API 端点可能不正确
- 需要特殊请求头

**解决方案**:
1. 测试 API 端点
2. 检查返回的数据格式
3. 调整解析逻辑

### Q4: 网易/新浪/腾讯显示"暂无数据"

**可能原因**:
- API 端点可能已变更
- 返回格式可能不同

**解决方案**:
1. 使用测试脚本测试爬虫
2. 检查 API 响应
3. 调整数据解析逻辑

## 如何修复爬虫

### 1. 找到正确的 API 端点

- 打开浏览器开发者工具
- 访问平台的热点页面
- 查看 Network 标签，找到 API 请求
- 复制请求 URL 和请求头

### 2. 更新爬虫实现

编辑对应的爬虫文件（如 `lib/services/crawlers/zhihu.ts`）：

```typescript
async crawl(): Promise<CrawlResult> {
  try {
    // 更新 API URL
    const url = '新的API端点'
    
    const response = await fetch(url, {
      headers: {
        // 添加必要的请求头
        'User-Agent': '...',
        'Cookie': '...', // 如果需要
      },
    })

    // 根据实际返回格式调整解析逻辑
    const data = await response.json()
    const items: NewsItem[] = data.实际字段名.map(...)
    
    return { success: true, platformId: this.platformId, data: items }
  } catch (error) {
    return { success: false, platformId: this.platformId, error: ... }
  }
}
```

### 3. 测试爬虫

```bash
pnpm test:crawler 平台ID
```

### 4. 运行完整爬取

在 Web 界面点击"立即爬取"，查看是否成功。

## 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. 平台 ID
2. 测试脚本的输出
3. API 响应示例（如果有）
4. 控制台错误日志
5. 数据库中的平台状态

