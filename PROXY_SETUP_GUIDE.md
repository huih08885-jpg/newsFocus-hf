# 代理服务器配置指南

## 📋 概述

为了解决生产环境（Vercel）爬虫失败的问题，系统已集成代理服务支持。代理服务可以绕过IP封禁和地理位置限制。

## 🔧 支持的代理服务

### 1. ScraperAPI（推荐）⭐⭐⭐⭐⭐

**优点**：
- 专业爬虫代理服务
- 支持中国境内IP
- 稳定可靠
- 有免费额度

**配置方法**：
1. 注册账号：https://www.scraperapi.com/
2. 获取API Key
3. 在Vercel环境变量中添加：
   ```
   SCRAPERAPI_KEY=your_api_key_here
   ```

**费用**：
- 免费额度：1000次请求/月
- 付费计划：$29/月起

### 2. Bright Data（企业级）⭐⭐⭐⭐

**优点**：
- 企业级代理服务
- 高质量IP池
- 支持全球IP

**配置方法**：
1. 注册账号：https://brightdata.com/
2. 获取API Key
3. 在Vercel环境变量中添加：
   ```
   BRIGHTDATA_KEY=your_api_key_here
   ```

**费用**：
- 需要联系销售获取报价

### 3. 自定义代理服务 ⭐⭐⭐

**配置方法**：
在Vercel环境变量中添加：
```
CUSTOM_PROXY_URL=https://your-proxy.com?url={encodedUrl}
```

**URL模板变量**：
- `{url}` - 原始URL（未编码）
- `{encodedUrl}` - 编码后的URL

### 4. Jina AI（免费但不稳定）⭐⭐

**说明**：
- 免费代理服务
- 可能不稳定或被封禁
- 仅作为后备方案

**配置方法**：
在Vercel环境变量中添加：
```
USE_JINA_PROXY=true
```

## 🚀 快速开始

### 步骤1：选择代理服务

推荐使用 **ScraperAPI**（有免费额度，稳定可靠）

### 步骤2：获取API Key

1. 访问 ScraperAPI 官网注册账号
2. 在Dashboard中获取API Key

### 步骤3：配置环境变量

在 **Vercel Dashboard** → **Settings** → **Environment Variables** 中添加：

```
SCRAPERAPI_KEY=your_scraperapi_key_here
```

### 步骤4：重新部署

配置完成后，重新部署应用：
```bash
git commit --allow-empty -m "配置代理服务"
git push
```

## 📊 优先级顺序

系统会按以下优先级选择代理服务：

1. **ScraperAPI**（如果配置了 `SCRAPERAPI_KEY`）
2. **Bright Data**（如果配置了 `BRIGHTDATA_KEY`）
3. **自定义代理**（如果配置了 `CUSTOM_PROXY_URL`）
4. **Jina AI**（如果配置了 `USE_JINA_PROXY=true`）
5. **不使用代理**（如果都没有配置）

## 🔍 工作原理

### 开发环境
- 默认直接请求目标网站
- 如果请求失败（如403），自动回退到代理

### 生产环境（Vercel）
- 如果配置了代理服务，**优先使用代理**
- 如果代理失败，回退到直接请求
- 这样可以最大程度避免403错误

## ⚙️ 高级配置

### 禁用代理

如果不想使用代理，设置：
```
DISABLE_PROXY=true
```

### 强制在Vercel使用代理

代理服务默认在Vercel环境自动启用，无需额外配置。

### 查看代理使用情况

系统会在日志中记录代理使用情况：
- `[ProxyService] 使用代理成功获取 {url}`
- `[ProxyService] 代理服务也返回错误`

## 🐛 故障排查

### 问题1：代理服务返回403

**可能原因**：
- API Key无效或过期
- 代理服务本身被目标网站封禁
- 代理服务配额用尽

**解决方案**：
1. 检查API Key是否正确
2. 检查代理服务Dashboard中的使用情况
3. 尝试其他代理服务

### 问题2：代理服务超时

**可能原因**：
- 代理服务响应慢
- 网络连接问题

**解决方案**：
1. 增加超时时间（代码中已设置为30秒）
2. 检查代理服务的状态页面
3. 尝试其他代理服务

### 问题3：代理服务不可用

**可能原因**：
- 代理服务暂时不可用
- 配置错误

**解决方案**：
1. 检查环境变量是否正确配置
2. 查看Vercel日志中的错误信息
3. 系统会自动回退到直接请求

## 📝 代码实现

代理服务集成在以下文件中：

- `lib/utils/proxy-service.ts` - 代理服务管理器
- `lib/utils/fetch-helper.ts` - HTTP请求工具（集成代理）
- `lib/services/lottery-crawler.ts` - 彩票爬虫（使用代理）

## 💡 最佳实践

1. **优先使用ScraperAPI**：稳定可靠，有免费额度
2. **监控使用量**：定期检查代理服务的使用情况
3. **设置预算限制**：避免意外产生高额费用
4. **备用方案**：配置多个代理服务，提高可用性

## 🔒 安全注意事项

1. **保护API Key**：
   - 不要在代码中硬编码API Key
   - 使用环境变量存储
   - 不要在Git仓库中提交API Key

2. **限制使用**：
   - 设置合理的请求频率
   - 避免滥用代理服务

3. **遵守服务条款**：
   - 遵守代理服务提供商的服务条款
   - 遵守目标网站的使用条款

## 📞 支持

如果遇到问题，请：

1. 查看Vercel日志中的错误信息
2. 检查代理服务的状态页面
3. 查看本文档的故障排查部分

