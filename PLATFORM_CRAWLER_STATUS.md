# 平台爬虫实现状态

## 已实现的平台 ✅

| 平台ID | 平台名称 | 状态 | 说明 |
|--------|---------|------|------|
| zhihu | 知乎 | ✅ 已实现 | 使用知乎热榜 API |
| weibo | 微博 | ✅ 已实现 | 使用微博热搜 API |
| baidu | 百度 | ✅ 已实现 | 使用百度热点 API |
| bilibili | B站 | ✅ 已实现 | 使用B站热门 API |
| douyin | 抖音 | ✅ 已实现 | 使用抖音热点 API |
| toutiao | 今日头条 | ✅ 已实现 | 使用今日头条热点 API |
| netease | 网易 | ✅ 已实现 | 使用网易新闻 API |
| sina | 新浪 | ✅ 已实现 | 使用新浪热点 API |
| qq | 腾讯 | ✅ 已实现 | 使用腾讯新闻 API |

## 待完善的平台 ⚠️

| 平台ID | 平台名称 | 状态 | 说明 |
|--------|---------|------|------|
| redbook | 小红书 | ⚠️ 待实现 | 暂无公开API，需要找到数据源 |
| douban | 豆瓣 | ⚠️ 待实现 | 需要实现爬虫 |

## 问题排查

### 为什么某些平台显示"暂无数据"？

可能的原因：

1. **爬虫未实现**
   - 检查 `lib/services/crawlers/index.ts` 中是否注册了该平台的爬虫
   - 检查是否存在对应的爬虫文件（如 `lib/services/crawlers/{platformId}.ts`）

2. **爬取失败**
   - 查看爬取任务的错误信息
   - 检查平台 API 是否可访问
   - 检查网络连接

3. **数据库中没有数据**
   - 运行爬取任务后，检查数据库中是否有该平台的新闻数据
   - 使用 Prisma Studio 查看：`pnpm db:studio`

4. **平台被禁用**
   - 检查数据库中平台的 `enabled` 字段是否为 `true`

## 如何添加新平台爬虫

1. 在 `lib/services/crawlers/` 目录下创建新文件（如 `{platformId}.ts`）
2. 实现 `PlatformCrawler` 接口
3. 在 `lib/services/crawlers/index.ts` 中注册爬虫
4. 测试爬虫是否正常工作

## API 端点说明

各平台的 API 端点可能会变更，需要定期检查和更新：

- **知乎**: `https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total`
- **微博**: `https://weibo.com/ajax/side/hotSearch`
- **百度**: `https://top.baidu.com/api/board`
- **B站**: `https://api.bilibili.com/x/web-interface/popular`
- **抖音**: `https://www.douyin.com/aweme/v1/web/hot/search/list/`
- **今日头条**: `https://www.toutiao.com/hot-event/hot-board/`
- **网易**: `https://3g.163.com/touch/reconstruct/article/list/BA8EE5GMwangning/`
- **新浪**: `https://feed.mix.sina.com.cn/api/roll/get`
- **腾讯**: `https://r.inews.qq.com/gw/event/hot_ranking_list`

## 注意事项

1. **API 变更**: 各平台的 API 可能会更新，需要定期检查
2. **反爬虫**: 某些平台可能有反爬虫机制，需要：
   - 设置合适的 User-Agent
   - 控制请求频率
   - 可能需要 Cookie 或 Token
3. **数据格式**: 不同平台的 API 返回格式可能不同，需要根据实际情况调整解析逻辑

