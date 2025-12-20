# AI 分析模块设置指南

## ✅ 已完成的工作

1. **数据库表创建**
   - ✅ `analysis_tasks` - AI 分析任务表
   - ✅ `analysis_shares` - 分析结果分享表
   - ✅ `analysis_comments` - 评论表
   - ✅ `analysis_likes` - 点赞表
   - ✅ `user_subscriptions` - 用户订阅表

2. **后端服务**
   - ✅ `CorpusGenerator` - 语料生成服务
   - ✅ `AIAnalysisService` - AI 分析服务
   - ✅ DeepSeek AI 服务扩展

3. **API 端点**
   - ✅ `POST /api/analysis/create` - 创建分析任务
   - ✅ `GET /api/analysis/[taskId]` - 获取分析任务详情
   - ✅ `GET /api/analysis/list` - 获取分析任务列表
   - ✅ `GET /api/analysis/subscription` - 获取用户订阅信息
   - ✅ `GET /api/analysis/sources` - 获取数据源列表

4. **前端页面**
   - ✅ `/analysis` - AI 分析页面
   - ✅ 侧边栏导航已添加

## 🚀 下一步操作

### 1. 生成 Prisma Client

```bash
npm run db:generate
# 或
npx prisma generate
```

### 2. 配置环境变量

确保 `.env.local` 中包含：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

如果没有 DeepSeek API Key，可以：
- 访问 https://platform.deepseek.com/ 注册账号
- 获取 API Key
- 添加到环境变量

### 3. 测试功能

运行测试脚本：

```bash
npx tsx scripts/test-ai-analysis.ts
```

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 访问 AI 分析页面

1. 登录系统
2. 访问 `/analysis` 页面
3. 点击"创建分析"按钮
4. 选择：
   - 分析类型（个人消化建议/趋势分析/商情分析）
   - 数据源类型（关键词爬虫/兴趣站点爬虫）
   - 数据源（从下拉列表选择）
5. 提交分析任务
6. 等待分析完成（会自动刷新）
7. 查看分析结果

## 📋 功能说明

### 分析类型

1. **个人消化吸收建议**
   - 提取核心知识点
   - 提供学习建议和路径
   - 推荐相关资源

2. **事态趋势分析**
   - 分析整体趋势
   - 识别关键节点
   - 预测未来发展方向

3. **商情价值情报分析**
   - 识别商业机会
   - 风险提示
   - 竞争分析

### 数据源

1. **关键词爬虫结果**
   - 从关键词组匹配的新闻生成语料
   - 需要先配置关键词组

2. **兴趣站点爬虫结果**
   - 从站点分组的爬虫结果生成语料
   - 需要先在"兴趣站点爬虫"模块添加站点

### 配额管理

- **免费版**: 每月 3 次分析
- **专业版**: 更多分析次数（待实现）
- **企业版**: 无限制（待实现）

配额每月自动重置。

## 🔧 故障排除

### 问题1: Prisma Client 未生成

**错误**: `Cannot find module '@prisma/client'`

**解决**:
```bash
npm run db:generate
```

### 问题2: 数据库表不存在

**错误**: `relation "analysis_tasks" does not exist`

**解决**: 执行数据库迁移脚本
```bash
# 开发环境
psql -U postgres -d newsFocus-hf -f sql/add_ai_analysis_tables_dev.sql

# 生产环境
psql "your_connection_string" -f sql/add_ai_analysis_tables_prod.sql
```

### 问题3: DeepSeek API 调用失败

**错误**: `API request failed: 401`

**解决**:
1. 检查 `DEEPSEEK_API_KEY` 是否正确设置
2. 检查 API Key 是否有效
3. 检查账户余额

### 问题4: 没有可用数据源

**提示**: "暂无可用的关键词组" 或 "暂无可用的站点分组"

**解决**:
1. 对于关键词组：在"关键词配置"页面创建关键词组
2. 对于站点分组：在"兴趣站点爬虫"页面创建站点分组并添加站点

## 📊 性能优化建议

1. **语料大小限制**: 默认最多 100 条数据，可在创建分析时调整
2. **异步处理**: 分析任务在后台异步执行，不会阻塞用户操作
3. **结果缓存**: 分析结果保存在数据库中，可重复查看

## 🎯 后续优化方向

1. **分享功能**: 实现分析结果的分享、评论、点赞功能
2. **订阅升级**: 实现付费订阅功能
3. **更多分析类型**: 根据用户需求添加新的分析类型
4. **批量分析**: 支持一次分析多个数据源
5. **分析历史**: 优化分析历史查看和管理

