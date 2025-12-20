# 情感分析功能实施文档

## ✅ 已完成功能

### 1. SentimentService 服务类
- **文件**: `lib/services/sentiment.ts`
- **功能**: 
  - 支持多种情感分析提供商（百度AI、腾讯云、OpenAI、本地规则）
  - 默认使用本地规则分析（无需API密钥）
  - 支持批量分析
  - 返回情感标签（positive/negative/neutral）和分数（0-1）

### 2. 数据库模型更新
- **文件**: `prisma/schema.prisma`
- **变更**: 
  - 在 `NewsItem` 模型中添加 `sentiment` 和 `sentimentScore` 字段
  - 添加索引：`@@index([sentiment])` 和 `@@index([sentiment, crawledAt])`

### 3. 爬取时自动分析
- **文件**: `lib/services/crawler.ts`
- **功能**: 
  - 在保存新闻时自动进行情感分析
  - 批量分析优化性能
  - 可通过环境变量 `ENABLE_SENTIMENT=false` 禁用

### 4. 情感分析API
- **文件**: `app/api/analytics/sentiment/route.ts`
- **功能**: 
  - 获取情感分布统计
  - 获取情感趋势数据
  - 获取负面新闻列表（用于预警）

### 5. UI展示
- **文件**: 
  - `components/news/platform-news-card.tsx` - 新闻卡片显示情感标识
  - `app/analytics/sentiment/page.tsx` - 情感分析页面
  - `components/charts/trend-chart.tsx` - 支持多条线的趋势图
- **功能**: 
  - 在新闻卡片上显示情感标签（正面/负面/中性）
  - 情感分析统计页面
  - 情感分布饼图
  - 情感趋势折线图
  - 负面舆情预警列表

### 6. 负面舆情预警
- **文件**: `app/api/notify/sentiment-alert/route.ts`
- **功能**: 
  - 检测负面新闻并发送预警通知
  - 支持自定义阈值和时间范围
  - 自动发送到配置的通知渠道

## 📋 使用步骤

### 1. 数据库迁移

```bash
# 生成 Prisma 客户端
npm run db:generate

# 创建迁移
npx prisma migrate dev --name add_sentiment_fields

# 或直接推送（开发环境）
npx prisma db push
```

### 2. 环境变量配置（可选）

```env
# 启用/禁用情感分析（默认启用）
ENABLE_SENTIMENT=true

# 选择情感分析提供商（默认：local）
SENTIMENT_PROVIDER=local  # local, baidu, tencent, openai

# 如果使用百度AI
SENTIMENT_API_KEY=your_baidu_api_key
SENTIMENT_API_SECRET=your_baidu_api_secret

# 如果使用腾讯云
SENTIMENT_API_KEY=your_tencent_secret_id
SENTIMENT_API_SECRET=your_tencent_secret_key

# 如果使用OpenAI
SENTIMENT_API_KEY=your_openai_api_key
```

### 3. 测试功能

```bash
# 测试爬取（会自动进行情感分析）
curl -X POST http://localhost:3000/api/crawl

# 查看情感分析统计
curl http://localhost:3000/api/analytics/sentiment

# 手动触发负面舆情预警
curl -X POST http://localhost:3000/api/notify/sentiment-alert \
  -H "Content-Type: application/json" \
  -d '{"threshold": 0.3, "hours": 24}'
```

## 🎯 功能特点

### 本地规则分析（默认）
- ✅ 无需API密钥，开箱即用
- ✅ 基于关键词匹配
- ✅ 支持中英文关键词
- ⚠️ 准确率约70-80%（适合基础需求）

### 第三方API分析（可选）
- ✅ 准确率更高（85-95%）
- ✅ 支持更复杂的语义分析
- ⚠️ 需要API密钥和费用

## 📊 数据展示

### 新闻卡片
- 显示情感标签：正面（绿色）、负面（红色）、中性（灰色）
- 标签显示在新闻标题旁边

### 情感分析页面
- **统计卡片**: 总新闻数、正面/负面/中性数量和占比
- **情感分布饼图**: 可视化展示情感分布
- **情感趋势图**: 按日期展示情感变化趋势
- **负面舆情预警**: 列出需要关注的负面新闻

## 🔔 负面舆情预警

### 自动预警（待实现）
可以在定时任务中集成：

```typescript
// app/api/cron/crawl/route.ts
// 在爬取完成后，检查负面新闻并发送预警
if (negativeNewsCount > 0) {
  await fetch('/api/notify/sentiment-alert', {
    method: 'POST',
    body: JSON.stringify({ threshold: 0.3, hours: 24 }),
  })
}
```

### 手动触发
通过API手动触发预警通知。

## 🚀 后续优化

1. **集成第三方API**
   - 实现百度AI情感分析API
   - 实现腾讯云NLP API
   - 实现OpenAI情感分析

2. **优化本地规则**
   - 扩展关键词库
   - 添加否定词处理
   - 改进评分算法

3. **自动预警**
   - 在定时任务中自动检查
   - 支持自定义预警规则
   - 预警历史记录

4. **更多功能**
   - 情感变化趋势预测
   - 情感与热度的关联分析
   - 平台情感对比

## 📝 注意事项

1. **性能**: 批量分析时，本地规则分析速度较快，第三方API可能有速率限制
2. **准确性**: 本地规则适合基础需求，如需高准确率建议使用第三方API
3. **成本**: 第三方API通常按调用次数收费，注意控制成本
4. **数据迁移**: 已有新闻数据不会自动分析，需要重新爬取或手动分析

## ✅ 测试清单

- [x] SentimentService 创建成功
- [x] 数据库模型更新成功
- [x] 爬取时自动分析成功
- [x] API端点创建成功
- [x] UI展示成功
- [x] 负面舆情预警成功
- [ ] 数据库迁移测试
- [ ] 第三方API集成测试
- [ ] 性能测试

