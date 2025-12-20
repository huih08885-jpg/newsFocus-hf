# 全网搜索功能配置指南

## 功能说明

全网搜索功能允许你使用多个搜索引擎（Google、Bing、DuckDuckGo等）搜索关键词，不局限于系统中已配置的平台。这样可以获取更广泛的信息源。

## 工作原理

1. **多引擎搜索**：同时使用多个搜索引擎API进行搜索
2. **结果聚合**：合并所有搜索引擎的结果
3. **自动去重**：根据标题自动去重
4. **统一格式**：将搜索结果转换为统一的新闻格式

## 配置步骤

### 1. Google Custom Search API

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Custom Search API"
4. 创建 API Key：
   - 导航到 "APIs & Services" > "Credentials"
   - 点击 "Create Credentials" > "API Key"
   - 复制 API Key
5. 创建搜索引擎：
   - 访问 [Google Custom Search](https://programmablesearchengine.google.com/)
   - 点击 "Add" 创建新的搜索引擎
   - 配置搜索引擎（可以设置为搜索整个网络）
   - 复制 "Search engine ID"

**环境变量配置**：
```bash
GOOGLE_SEARCH_API_KEY=your_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### 2. Bing Search API

1. 访问 [Azure Portal](https://portal.azure.com/)
2. 创建 "Bing Search v7" 资源
3. 获取 API Key：
   - 在资源页面找到 "Keys and Endpoint"
   - 复制其中一个 Key

**环境变量配置**：
```bash
BING_SEARCH_API_KEY=your_bing_api_key_here
```

### 3. DuckDuckGo（无需配置）

DuckDuckGo 搜索不需要 API Key，可以直接使用。

## 使用方式

### 在爬取配置爬取

1. 点击"立即爬取"按钮
2. 选择"🌐 全网搜索"模式
3. 输入要搜索的关键词（支持多个关键词，用逗号、换行或空格分隔）
4. 点击"开始爬取"

### 特点

- ✅ **不限制平台**：搜索整个互联网，不局限于已配置的平台
- ✅ **多引擎支持**：同时使用多个搜索引擎，提高覆盖率
- ✅ **自动去重**：自动去除重复结果
- ✅ **无需配置平台**：选择全网搜索时，不需要选择具体平台

## 注意事项

1. **API配额限制**：
   - Google Custom Search：每天免费100次查询
   - Bing Search API：每月免费3000次查询
   - DuckDuckGo：无限制，但可能被限流

2. **搜索结果质量**：
   - 搜索结果的质量取决于搜索引擎的算法
   - 不同搜索引擎可能返回不同的结果
   - 建议结合多个搜索引擎使用

3. **成本考虑**：
   - Google 和 Bing 都有免费配额
   - 超出免费配额后需要付费
   - DuckDuckGo 完全免费

4. **实时匹配**：
   - 全网搜索模式下，不使用关键词组实时匹配
   - 因为搜索结果本身就是基于关键词的

## 故障排除

### Google API 错误

如果遇到 Google API 错误：
- 检查 API Key 是否正确
- 检查 Search Engine ID 是否正确
- 检查是否启用了 Custom Search API
- 检查是否超出了每日配额

### Bing API 错误

如果遇到 Bing API 错误：
- 检查 API Key 是否正确
- 检查是否创建了 Bing Search v7 资源
- 检查是否超出了每月配额

### 搜索结果为空

如果搜索结果为空：
- 检查关键词是否正确
- 尝试使用不同的关键词
- 检查网络连接
- 查看控制台日志了解详细错误

## 未来改进

- [ ] 支持更多搜索引擎（Yahoo、Yandex等）
- [ ] 搜索结果排序优化
- [ ] 搜索结果质量评分
- [ ] 缓存机制减少API调用
- [ ] 支持搜索结果过滤（按域名、日期等）

