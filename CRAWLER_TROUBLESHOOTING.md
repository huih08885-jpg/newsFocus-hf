# 爬虫故障排查指南

## 问题：所有平台爬取失败，显示 "fetch failed"

### 快速诊断

运行诊断脚本：
```bash
pnpm test:api
```

或：
```bash
tsx scripts/test-api-connection.ts
```

### 常见原因及解决方案

#### 1. API 服务器不可用

**症状**：
- DNS 解析成功，但 HTTP 连接失败
- 错误信息：`ECONNREFUSED` 或 `ETIMEDOUT`

**解决方案**：
- 检查 API 端点 `https://newsnow.busiyi.world/api/s` 是否可访问
- 在浏览器中访问测试 URL：`https://newsnow.busiyi.world/api/s?id=zhihu&latest`
- 如果浏览器也无法访问，说明 API 服务可能已关闭或迁移

**临时方案**：
- 配置备用 API 端点（如果可用）
- 在 `.env` 文件中设置：
  ```env
  CRAWLER_API_URL=https://your-backup-api.com/api/s
  ```

#### 2. DNS 解析失败

**症状**：
- 错误信息：`ENOTFOUND`
- DNS 测试失败

**解决方案**：
- 检查网络连接
- 尝试使用其他 DNS 服务器（如 8.8.8.8 或 1.1.1.1）
- 检查 hosts 文件是否有相关配置

#### 3. 防火墙/网络限制

**症状**：
- 本地网络正常，但无法访问特定域名
- 错误信息：`fetch failed` 无具体原因

**解决方案**：
- 检查防火墙设置
- 检查公司/学校网络是否限制访问
- 尝试使用 VPN
- 检查代理设置

#### 4. SSL/TLS 证书问题

**症状**：
- 错误信息：`CERT_HAS_EXPIRED` 或 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**解决方案**：
- 检查系统时间是否正确
- 更新 CA 证书
- 如果是在开发环境，可以临时禁用 SSL 验证（不推荐用于生产）

#### 5. 代理配置问题

**症状**：
- 需要代理才能访问外网
- 错误信息：连接超时

**解决方案**：
在 `.env` 文件中配置代理：
```env
PROXY_URL=http://proxy.example.com:8080
```

注意：Node.js 的 `fetch` API 不直接支持 HTTP 代理。如果需要代理，可能需要：
- 在系统层面配置代理（环境变量 `HTTP_PROXY`、`HTTPS_PROXY`）
- 使用支持代理的 HTTP 客户端库（如 `axios` 或 `node-fetch`）

### 环境变量配置

在 `.env` 文件中可以配置以下变量：

```env
# API 端点（可选，默认：https://newsnow.busiyi.world/api/s）
CRAWLER_API_URL=https://newsnow.busiyi.world/api/s

# 代理 URL（可选）
PROXY_URL=http://proxy.example.com:8080

# 请求间隔（毫秒，可选，默认：1000）
REQUEST_INTERVAL=1000
```

### 手动测试步骤

1. **测试 DNS 解析**：
   ```bash
   nslookup newsnow.busiyi.world
   # 或
   ping newsnow.busiyi.world
   ```

2. **测试 HTTP 连接**：
   ```bash
   curl "https://newsnow.busiyi.world/api/s?id=zhihu&latest"
   ```

3. **在浏览器中测试**：
   访问：`https://newsnow.busiyi.world/api/s?id=zhihu&latest`
   应该返回 JSON 数据

4. **检查 Node.js 环境**：
   ```bash
   node -e "fetch('https://newsnow.busiyi.world/api/s?id=zhihu&latest').then(r => r.json()).then(console.log).catch(console.error)"
   ```

### 详细错误日志

运行爬虫时，现在会输出详细的诊断信息：

- API 连接测试结果
- DNS 解析状态
- 每个平台的详细错误信息
- 错误堆栈（最后一次尝试时）

查看控制台输出，根据错误信息定位问题。

### 联系支持

如果以上方法都无法解决问题，请提供以下信息：

1. 诊断脚本的完整输出
2. `curl` 测试的结果
3. 浏览器访问测试 URL 的结果
4. 网络环境（是否在公司/学校网络，是否需要 VPN）
5. Node.js 版本：`node --version`
6. 操作系统信息

### 临时解决方案

如果 API 服务确实不可用，可以考虑：

1. **使用备用数据源**：如果有其他可用的新闻 API
2. **本地数据**：使用之前爬取的数据进行测试
3. **模拟数据**：在开发环境中使用模拟数据

