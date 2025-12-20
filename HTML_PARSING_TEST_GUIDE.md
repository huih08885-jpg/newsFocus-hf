# HTML解析功能测试指南

## 前置条件

### 1. 安装依赖

首先需要安装 `cheerio` 包：

```bash
npm install cheerio
```

如果需要TypeScript类型支持（可选）：

```bash
npm install --save-dev @types/cheerio
```

### 2. 验证安装

运行验证脚本检查cheerio是否已正确安装：

```bash
npx tsx scripts/verify-html-parser.ts
```

如果看到 "✅ Cheerio已安装" 和 "✅ HTML解析器代码逻辑验证通过！"，说明安装成功。

## 测试步骤

### 步骤1: 验证代码逻辑

```bash
npx tsx scripts/verify-html-parser.ts
```

### 步骤2: 测试实际爬虫功能

运行完整的爬虫测试（会实际访问网站）：

```bash
npm run test:crawler:html
```

或直接运行：

```bash
npx tsx scripts/test-crawler-html.ts
```

### 步骤3: 测试单个平台

如果只想测试特定平台，可以修改 `scripts/test-crawler-html.ts`，注释掉不需要的平台。

## 预期结果

### 成功情况

每个平台的测试应该显示：
- ✅ 成功！耗时: XXXms
- 📊 获取到 X 条新闻
- 前3条结果的标题和URL

### HTML解析优先

日志中应该看到：
```
[Zhihu] HTML解析成功，获取到 X 条新闻
```

### API降级

如果HTML解析失败，会看到：
```
[Zhihu] HTML解析失败或未获取到数据，尝试API...
[Zhihu] API解析成功，获取到 X 条新闻
```

## 故障排查

### 问题1: Module not found: cheerio

**解决方案**: 运行 `npm install cheerio`

### 问题2: HTML解析失败，但API成功

这是正常情况，说明：
- HTML解析尝试失败（可能是页面结构变化或反爬虫）
- 系统自动降级到API方式
- 功能仍然可用

### 问题3: 两个方式都失败

可能的原因：
- 网络连接问题
- 平台API变更
- 反爬虫机制
- 需要更新选择器

## 代码检查清单

- [x] HTMLParser工具类已创建 (`lib/utils/html-parser.ts`)
- [x] 知乎爬虫已更新 (`lib/services/crawlers/zhihu.ts`)
- [x] 微博爬虫已更新 (`lib/services/crawlers/weibo.ts`)
- [x] 百度爬虫已更新 (`lib/services/crawlers/baidu.ts`)
- [x] 测试脚本已创建 (`scripts/test-crawler-html.ts`)
- [x] 验证脚本已创建 (`scripts/verify-html-parser.ts`)
- [ ] cheerio依赖已安装
- [ ] 实际测试已运行

## 下一步

1. 安装cheerio依赖
2. 运行验证脚本
3. 运行完整测试
4. 根据测试结果调整选择器（如需要）

