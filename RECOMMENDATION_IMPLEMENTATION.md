# 个性化推荐系统实施总结

## 📋 概述

已成功实施个性化推荐系统和收藏功能，这是基于竞品分析后的第二个高优先级功能。

## ✅ 已完成功能

### 1. 数据库模型扩展

#### UserAction 模型
- **用途**: 记录用户行为（查看、点击、收藏、分享）
- **字段**:
  - `userId`: 用户ID
  - `newsItemId`: 新闻ID
  - `action`: 行为类型（view, click, collect, share）
  - `createdAt`: 创建时间

#### UserCollection 模型
- **用途**: 用户收藏的新闻
- **字段**:
  - `userId`: 用户ID
  - `newsItemId`: 新闻ID
  - `createdAt`: 收藏时间
- **唯一约束**: `userId + newsItemId` 防止重复收藏

### 2. 推荐服务 (RecommenderService)

**文件**: `lib/services/recommender.ts`

#### 核心功能

1. **用户行为记录**
   - `recordUserAction()`: 记录用户行为

2. **个性化推荐**
   - `getRecommendations()`: 基于用户行为历史推荐新闻
   - 推荐算法：
     - 平台偏好分析（30%权重）
     - 关键词匹配（40%权重）
     - 新闻权重分数（20%权重）
     - 时间衰减（10%权重）

3. **相关新闻推荐**
   - `getRelatedNews()`: 基于内容相似度推荐相关新闻
   - 通过关键词匹配找到相似新闻

4. **热门新闻**
   - 当用户没有行为历史时，返回热门新闻

### 3. API 端点

#### 推荐相关
- `GET /api/news/recommendations` - 获取个性化推荐
  - 参数: `limit`, `excludeViewed`, `minScore`
- `GET /api/news/[id]/related` - 获取相关新闻
  - 参数: `limit`

#### 行为记录
- `POST /api/news/[id]/action` - 记录用户行为
  - Body: `{ action: 'view' | 'click' | 'collect' | 'share' }`

#### 收藏相关
- `POST /api/news/[id]/collect` - 收藏新闻
- `DELETE /api/news/[id]/collect` - 取消收藏
- `GET /api/news/[id]/collect` - 检查收藏状态
- `GET /api/news/collections` - 获取收藏列表
  - 参数: `limit`, `offset`

### 4. UI 组件

#### CollectButton (`components/news/collect-button.tsx`)
- 收藏/取消收藏按钮
- 自动检查收藏状态
- 显示收藏状态（已收藏/未收藏）

#### RelatedNews (`components/news/related-news.tsx`)
- 显示相关新闻推荐
- 在新闻详情页展示

#### NewsViewTracker (`components/news/news-view-tracker.tsx`)
- 自动追踪用户查看行为
- 延迟1秒记录，确保用户确实查看了内容

### 5. 页面

#### 个性化推荐页面 (`app/recommendations/page.tsx`)
- 展示个性化推荐新闻列表
- 显示推荐分数和推荐理由
- 支持收藏和打开链接
- 自动记录点击行为

#### 收藏页面 (`app/collections/page.tsx`)
- 展示用户收藏的新闻列表
- 支持分页加载
- 支持取消收藏
- 显示收藏时间

#### 新闻详情页更新 (`app/news/[id]/page.tsx`)
- 添加收藏按钮
- 添加相关新闻推荐
- 自动记录查看行为

### 6. 导航更新

更新了侧边栏 (`components/layout/sidebar.tsx`)，添加：
- "个性化推荐" 链接（需要登录）
- "我的收藏" 链接（需要登录）

## 🔧 技术实现细节

### 推荐算法

1. **用户偏好分析**
   - 分析最近30天的用户行为
   - 计算平台偏好分数
   - 计算关键词偏好分数
   - 不同行为权重：view(1), click(2), collect(5), share(3)

2. **推荐分数计算**
   ```
   总分 = 平台偏好(30%) + 关键词匹配(40%) + 新闻权重(20%) + 时间衰减(10%)
   ```

3. **推荐理由生成**
   - 基于平台偏好
   - 基于关键词匹配
   - 基于新闻热度

### 数据流

1. **用户行为记录**
   ```
   用户操作 → API端点 → RecommenderService.recordUserAction() → 数据库
   ```

2. **推荐生成**
   ```
   用户请求 → API端点 → RecommenderService.getRecommendations() 
   → 分析用户偏好 → 计算推荐分数 → 返回推荐列表
   ```

3. **相关新闻**
   ```
   新闻ID → API端点 → RecommenderService.getRelatedNews() 
   → 查找关键词匹配 → 返回相关新闻
   ```

## 📊 数据库变更

### 新增表

1. **user_actions**
   - 索引: `userId + createdAt`, `newsItemId`, `action`, `userId + action + createdAt`

2. **user_collections**
   - 索引: `userId + createdAt`, `newsItemId`
   - 唯一约束: `userId + newsItemId`

### SQL 脚本更新

已更新 `sql/init-dev.sql` 和 `sql/init-prod.sql`，包含：
- 表结构定义
- 索引创建
- 外键约束

## 🚀 使用说明

### 1. 数据库迁移

执行数据库迁移以创建新表：

```bash
# 开发环境
npm run db:push

# 或使用 SQL 脚本
psql -U postgres -d newsfocus_dev -f sql/init-dev.sql
```

### 2. 功能使用

#### 个性化推荐
1. 登录系统
2. 浏览新闻，系统会自动记录行为
3. 访问"个性化推荐"页面查看推荐内容

#### 收藏功能
1. 在新闻详情页点击"收藏"按钮
2. 访问"我的收藏"页面查看所有收藏
3. 可以取消收藏

#### 相关新闻
- 在新闻详情页底部自动显示相关新闻推荐

## 📈 性能优化

1. **索引优化**
   - 用户行为表多维度索引
   - 收藏表唯一约束防止重复

2. **查询优化**
   - 限制候选新闻数量（200条）
   - 限制推荐数量（默认10条）
   - 使用时间范围过滤（最近7天）

3. **缓存策略**
   - 可以考虑缓存用户偏好分析结果
   - 可以考虑缓存热门新闻列表

## 🔮 未来改进

1. **推荐算法优化**
   - 引入机器学习模型
   - 支持实时学习用户偏好
   - 增加多样性推荐

2. **行为分析**
   - 分析用户阅读时长
   - 分析用户跳转路径
   - 分析用户兴趣变化趋势

3. **推荐理由**
   - 更详细的推荐理由
   - 可视化推荐原因

4. **A/B 测试**
   - 测试不同推荐算法效果
   - 优化推荐参数

## 📝 注意事项

1. **隐私保护**
   - 用户行为数据仅用于推荐
   - 不泄露用户隐私信息

2. **性能考虑**
   - 推荐计算可能较耗时
   - 考虑异步处理和缓存

3. **数据清理**
   - 定期清理过期行为数据
   - 限制行为记录数量

## ✅ 完成状态

- [x] 数据库模型设计
- [x] 推荐服务实现
- [x] API 端点开发
- [x] UI 组件开发
- [x] 页面开发
- [x] 导航更新
- [x] SQL 脚本更新
- [x] 文档编写

## 🎯 下一步

根据功能路线图，下一个高优先级功能是：
- **收藏分类和标签**（收藏功能增强）
- **搜索功能**（全文搜索）
- **通知推送优化**（个性化通知）

