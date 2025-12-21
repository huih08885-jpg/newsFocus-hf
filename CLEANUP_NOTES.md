# 代码清理说明

## 清理目标
保留福利彩票的所有功能，移除新闻聚焦（newsFocus）相关功能。

## 已完成的清理

### 1. 布局和导航
- ✅ 更新了 `app/layout.tsx` 的标题和描述
- ✅ 导航菜单已只显示福利彩票相关功能（新闻聚焦相关已注释）

### 2. 定时任务
- ✅ 注释了 `vercel.json` 中的新闻聚焦相关定时任务

### 3. 需要清理的内容

#### API 路由（需要注释/删除）
- `/api/news/**` - 新闻相关API
- `/api/crawl/**` - 新闻爬虫API（保留 `/api/lottery/crawl`）
- `/api/config/**` - 新闻配置API（保留 `/api/lottery/config`）
- `/api/analytics/**` - 新闻分析API
- `/api/notify/**` - 新闻通知API
- `/api/cron/**` - 新闻定时任务API
- `/api/search/**` - 新闻搜索API
- `/api/collections/**` - 新闻收藏API
- `/api/rss/**` - RSS订阅API
- `/api/sites/**` - 站点管理API
- `/api/demand-radar/**` - 需求雷达API
- `/api/ai-search/**` - AI搜索API
- `/api/analysis/**` - AI分析API

#### 页面（需要注释/删除）
- `/app/news/**` - 新闻页面
- `/app/platforms/**` - 平台页面
- `/app/analytics/**` - 数据分析页面（新闻相关）
- `/app/history/**` - 历史查询页面（新闻相关）
- `/app/settings/**` - 设置页面（新闻相关）
- `/app/search/**` - 搜索页面
- `/app/collections/**` - 收藏页面
- `/app/recommendations/**` - 推荐页面
- `/app/discover/**` - 发现页面
- `/app/sites/**` - 站点页面
- `/app/demand-radar/**` - 需求雷达页面
- `/app/ai-search/**` - AI搜索页面
- `/app/analysis/**` - AI分析页面

#### 服务文件（需要注释/删除）
- `lib/services/crawler.ts` - 新闻爬虫服务
- `lib/services/matcher.ts` - 关键词匹配服务
- `lib/services/calculator.ts` - 权重计算服务
- `lib/services/report.ts` - 报告生成服务
- `lib/services/notifier.ts` - 通知服务
- `lib/services/data.ts` - 数据服务（新闻相关）
- `lib/services/search.ts` - 搜索服务
- `lib/services/recommender.ts` - 推荐服务
- `lib/services/sentiment.ts` - 情感分析服务
- `lib/services/share.ts` - 分享服务
- `lib/services/crawlers/**` - 新闻爬虫实现
- `lib/services/demand-radar.ts` - 需求雷达服务
- `lib/services/ai-search.ts` - AI搜索服务
- `lib/services/ai-analysis.ts` - AI分析服务
- `lib/services/interest-site-crawler.ts` - 兴趣站点爬虫
- `lib/services/site-subscription.ts` - 站点订阅服务

#### 组件（需要注释/删除）
- `components/news/**` - 新闻相关组件
- `components/search/**` - 搜索相关组件
- `components/collections/**` - 收藏相关组件
- `components/charts/**` - 图表组件（如果只用于新闻）

### 4. 保留的内容
- ✅ `/app/lottery/**` - 所有福利彩票页面
- ✅ `/app/api/lottery/**` - 所有福利彩票API
- ✅ `/components/lottery/**` - 所有福利彩票组件
- ✅ `lib/services/lottery-*.ts` - 所有福利彩票服务
- ✅ `/app/api/auth/**` - 认证API（可能被福利彩票使用）
- ✅ `/app/login`, `/app/register` - 登录注册页面
- ✅ `/app/privacy` - 隐私政策页面

## 注意事项
1. 清理时采用注释方式，便于后续恢复
2. 确保福利彩票功能完全不受影响
3. 数据库schema暂时不修改，避免数据丢失

